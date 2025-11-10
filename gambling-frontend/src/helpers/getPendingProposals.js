// src/helpers/getPendingProposals.js
import { ZeroAddress } from "ethers";

/**
 * Robust getPendingProposals:
 * - Uses on-chain pendingProposals(index) to decide pairing/visibility
 * - Skips ZeroAddress / paired / confirmed proposals
 * - Dedupes by index
 */
export const getPendingProposals = async (contract, viewerRaw) => {
  if (!contract) throw new Error("Contract not available");
  if (!viewerRaw) throw new Error("Viewer address is missing");

  const viewer = viewerRaw.toLowerCase();

  try {
    const [
      indexes,
      proposers,
      stakes,
      gameTypes,
      isConfirmeds,
      hasPendingPairings,
      isOpponents,
    ] = await contract.getPendingProposalsFor(viewer);

    // read viewer pairingRequests once
    let viewerReq = { isPending: false, matchProposalIndex: null, opponent: null };
    try {
      const rawViewerReq = await contract.pairingRequests(viewer);
      viewerReq = {
        isPending: Boolean(rawViewerReq?.isPending),
        matchProposalIndex:
          rawViewerReq?.matchProposalIndex !== undefined
            ? Number(rawViewerReq.matchProposalIndex)
            : null,
        opponent: rawViewerReq?.opponent ? String(rawViewerReq.opponent).toLowerCase() : null,
      };
    } catch (err) {
      console.warn("Could not read viewer pairingRequests:", err);
    }
    console.log("🛰 viewerReq:", viewerReq);

    const proposals = [];

    // Iterate returned indexes and consult on-chain to be 100% sure
    for (let i = 0; i < indexes.length; i++) {
      const idx = Number(indexes[i]);

      // try read on-chain latest struct for this index (best source of truth)
      let latest = null;
      try {
        latest = await contract.pendingProposals(idx);
      } catch (err) {
        console.warn("⚠ Could not read pendingProposals(index):", idx, err);
        // fall back to arrays returned by getPendingProposalsFor
      }

      // resolve proposer/opponent/isConfirmed robustly
      const proposerFromLatest = latest ? String(latest.proposer ?? latest[0] ?? "").toLowerCase() : (String(proposers[i] ?? "")).toLowerCase();
      const opponentFromLatest = latest
        ? (latest.opponent !== undefined ? String(latest.opponent).toLowerCase() : (latest[1] !== undefined ? String(latest[1]).toLowerCase() : null))
        : null;
      const isConfirmedFromLatest = latest
        ? (latest.isConfirmed !== undefined ? Boolean(latest.isConfirmed) : (latest[4] !== undefined ? Boolean(latest[4]) : false))
        : Boolean(isConfirmeds[i]);

      // Defensive checks: skip invalid / already paired / confirmed entries
      if (!proposerFromLatest || proposerFromLatest === ZeroAddress) {
        console.warn("⚠ Skipping invalid proposer for index:", idx, proposerFromLatest);
        continue;
      }
      if ((opponentFromLatest && opponentFromLatest !== ZeroAddress) || isConfirmedFromLatest === true) {
        // Already paired or confirmed on-chain — ignore it for the "confirm" UI
        console.log("🔒 Skipping paired/confirmed index:", idx, { opponentFromLatest, isConfirmedFromLatest });
        continue;
      }

      // build normalized entry (prefer on-chain latest values when available)
      const entry = {
        matchProposalIndex: idx,
        proposer: proposerFromLatest,
        stake: latest ? (latest.stake ?? stakes[i]) : stakes[i],
        gameType: latest ? (latest.gameType ?? gameTypes[i] ?? "Unknown") : (gameTypes[i] ?? "Unknown"),
        isConfirmed: isConfirmedFromLatest,
        hasPendingPairing: latest ? Boolean(latest.hasPendingPairings ?? false) : Boolean(hasPendingPairings[i]),
        isOpponent: Boolean(isOpponents[i]),
        // flags to populate next
        isChallenger: false,
        waitingForOpponent: false,
        awaitingResponse: false,
        challenger: null,
        isPaired: false, // we've already checked paired above; keep flag for completeness
      };

      proposals.push(entry);
    } // end for indexes

    // If viewer has a pairing index that wasn't included above (e.g., helper didn't return it),
    // attempt to inject it if the on-chain slot exists and is unpaired.
    if (viewerReq.matchProposalIndex != null) {
      const exists = proposals.some((p) => Number(p.matchProposalIndex) === Number(viewerReq.matchProposalIndex));
      if (!exists) {
        try {
          const raw = await contract.pendingProposals(viewerReq.matchProposalIndex);
          const rawProposer = String(raw.proposer ?? raw[0] ?? "").toLowerCase();
          const rawOpponent = raw.opponent !== undefined ? String(raw.opponent).toLowerCase() : (raw[1] !== undefined ? String(raw[1]).toLowerCase() : null);
          const rawIsConfirmed = raw.isConfirmed !== undefined ? Boolean(raw.isConfirmed) : (raw[4] !== undefined ? Boolean(raw[4]) : false);

          if (rawProposer && rawProposer !== ZeroAddress && !(rawOpponent && rawOpponent !== ZeroAddress) && rawIsConfirmed !== true) {
            const injected = {
              matchProposalIndex: Number(viewerReq.matchProposalIndex),
              proposer: rawProposer,
              stake: raw.stake ?? 0,
              gameType: raw.gameType ?? "Unknown",
              isConfirmed: false,
              hasPendingPairing: true,
              isOpponent: false,
              isChallenger: true,
              waitingForOpponent: true,
              awaitingResponse: false,
              challenger: viewer,
              isPaired: false,
            };
            proposals.unshift(injected);
            console.log("🔁 Injected missing target proposal for challenger view:", injected);
          } else {
            console.log("ℹ Not injecting viewer target; slot is paired/invalid:", { rawProposer, rawOpponent, rawIsConfirmed });
          }
        } catch (err) {
          console.warn("⚠ Could not fetch missing proposal via pendingProposals() for viewer index:", viewerReq.matchProposalIndex, err);
        }
      }
    }

    // Now populate pairing flags from pairingRequests and mark awaiting/response states
    for (const p of proposals) {
      try {
        const rawProposerReq = await contract.pairingRequests(p.proposer);

        // CASE A: viewer is challenger (sent request aimed at this proposal)
        if (viewerReq.isPending && viewerReq.matchProposalIndex === Number(p.matchProposalIndex) && viewerReq.opponent === p.proposer) {
          p.isChallenger = true;
          p.waitingForOpponent = true;
          p.hasPendingPairing = true;
        }

        // CASE B: viewer is proposer and someone targeted them
        if (viewer === p.proposer) {
          const rawChallengerReq = rawProposerReq;
          const challengerAddr = rawChallengerReq?.opponent ? String(rawChallengerReq.opponent).toLowerCase() : null;

          if (rawChallengerReq && rawChallengerReq.isPending && Number(rawChallengerReq.matchProposalIndex) === Number(p.matchProposalIndex) && challengerAddr && challengerAddr !== ZeroAddress) {
            p.hasPendingPairing = true;
            p.challenger = challengerAddr;

            const challengerEntry = proposals.find((q) => q.proposer === challengerAddr);
            if (challengerEntry) {
              challengerEntry.awaitingResponse = true;
              challengerEntry.isOpponent = true;
              challengerEntry.hasPendingPairing = true;
              challengerEntry.challengerOf = p.proposer;
            } else {
              p.awaitingResponse = true;
              p.isOpponent = true;
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Error processing proposal flags for index", p.matchProposalIndex, err);
      }
    }

    // Deduplicate by matchProposalIndex (safety)
    const seen = new Set();
    const unique = [];
    for (const p of proposals) {
      const k = Number(p.matchProposalIndex);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(p);
    }

    // Final visibility: show viewer's own proposal, ones they challenged, ones awaiting response,
    // ones waiting for opponent, or open ones with no pending pairing — but never show paired/confirmed entries.
    const visibleProposals = unique.filter(
      (p) =>
        !p.isConfirmed &&
        !p.isPaired &&
        (
          p.proposer === viewer ||
          p.isChallenger ||
          p.awaitingResponse ||
          p.waitingForOpponent ||
          !p.hasPendingPairing
        )
    );

    console.log("🧩 Raw proposals before filtering (unique):", unique);
    console.log("🧩 After normalization (before return):", unique);
    console.log("✅ Final normalized proposals (visible):", visibleProposals);
    return visibleProposals;
  } catch (err) {
    console.error("❌ Error fetching proposals:", err);
    throw err;
  }
};
