// src/helpers/getPendingProposals.js
import { ZeroAddress } from "ethers";

// helper: try to find an address-like field in the returned struct/tuple
function findAddressInStruct(raw) {
  try {
    // If it's an object with named props, scan them
    if (raw && typeof raw === "object") {
      for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (typeof v === "string" && v.toLowerCase().startsWith("0x") && v.length >= 42) {
          return v.toLowerCase();
        }
      }
      // If it's an array-like (ethers returns indices), check numeric keys
      for (let i = 0; i < Object.keys(raw).length; i++) {
        const v = raw[i];
        if (typeof v === "string" && v.toLowerCase().startsWith("0x") && v.length >= 42) {
          return v.toLowerCase();
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

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

    const proposals = [];

    // Build base proposals array
    for (let i = 0; i < indexes.length; i++) {
      const indexNum = Number(indexes[i]);
      const proposer = (proposers[i] || "").toLowerCase();
      const isConfirmed = Boolean(isConfirmeds[i]);
      const hasPending = Boolean(hasPendingPairings[i]);

      if (!isConfirmed) {
        proposals.push({
          matchProposalIndex: indexNum,
          proposer,
          stake: stakes[i],
          gameType: gameTypes[i] || "Unknown",
          isConfirmed,
          hasPendingPairing: hasPending,
          isOpponent: Boolean(isOpponents[i]),
          isChallenger: false,
          waitingForOpponent: false,
          awaitingResponse: false,
          challenger: null,
          isPaired: false, // will compute below
        });
      }
    }

    // Read viewer pairingRequests once
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

    // If viewer has a match index but the proposal isn't in list, try to fetch it (inject)
    if (viewerReq.matchProposalIndex != null) {
      const exists = proposals.some((p) => Number(p.matchProposalIndex) === Number(viewerReq.matchProposalIndex));
      if (!exists) {
        try {
          const raw = await contract.pendingProposals(viewerReq.matchProposalIndex);
          const rawProposer = String(raw.proposer ?? raw[0] ?? "").toLowerCase();
          const rawStake = raw.stake ?? raw[2] ?? raw[3] ?? 0;
          const rawGameType = raw.gameType ?? raw[4] ?? "Unknown";

          if (!rawProposer || rawProposer === ZeroAddress) {
            console.warn("⚠ pendingProposals() returned empty proposer:", raw);
          } else {
            // inject: we treat this as the target (even if viewerReq.opponent mismatched)
            const injected = {
              matchProposalIndex: Number(viewerReq.matchProposalIndex),
              proposer: rawProposer,
              stake: rawStake,
              gameType: rawGameType || "Unknown",
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
            console.log("🔁 Injected proposal from pendingProposals():", injected);
          }
        } catch (err) {
          console.warn("⚠ Could not fetch missing proposal via pendingProposals():", err);
        }
      }
    }

    // Populate flags and *detect paired* status by reading latest on-chain proposal
    for (const p of proposals) {
      try {
        // read proposer's pairingRequests entry
        const rawProposerReq = await contract.pairingRequests(p.proposer);

        // CASE A: viewer is challenger
        if (
          viewerReq.isPending &&
          viewerReq.matchProposalIndex === Number(p.matchProposalIndex) &&
          viewerReq.opponent === p.proposer
        ) {
          p.isChallenger = true;
          p.waitingForOpponent = true;
          p.hasPendingPairing = true;
        }

        // CASE B: viewer is proposer who has been challenged
        if (viewer === p.proposer) {
          const rawChallengerReq = rawProposerReq;
          const challengerAddr =
            rawChallengerReq && rawChallengerReq.opponent
              ? String(rawChallengerReq.opponent).toLowerCase()
              : null;

          if (
            rawChallengerReq &&
            rawChallengerReq.isPending &&
            Number(rawChallengerReq.matchProposalIndex) === Number(p.matchProposalIndex) &&
            challengerAddr &&
            challengerAddr !== ZeroAddress
          ) {
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

        // --- NEW: fetch latest on-chain proposal and detect pairing/confirmation robustly ---
        try {
          const latest = await contract.pendingProposals(p.matchProposalIndex);
          console.log("🔎 latest raw for index", p.matchProposalIndex, latest);

          // Try to find an address-like field (opponent) in the returned struct/tuple
          const actualOpponent = findAddressInStruct(latest);
          // Try to find an isConfirmed-like boolean
          // prefer named field if exists:
          const actualIsConfirmed = (latest && (latest.isConfirmed !== undefined ? latest.isConfirmed : (latest[4] !== undefined ? latest[4] : false)));

          if ((actualOpponent && actualOpponent !== ZeroAddress) || actualIsConfirmed === true) {
            p.isPaired = true;
            console.log("🔒 Proposal isPaired detected:", p.matchProposalIndex, { actualOpponent, actualIsConfirmed });
          }
        } catch (err) {
          // best-effort: don't fail whole flow
          console.warn("Could not read pendingProposals(index) for detection:", p.matchProposalIndex, err);
        }
      } catch (err) {
        console.warn("⚠️ Error processing proposal", p.matchProposalIndex, err);
      }
    } // end for proposals

    // Final visibility: hide proposals that are paired/confirmed
    const visibleProposals = proposals.filter(
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

    console.log("✅ Final normalized proposals:", visibleProposals);
    return visibleProposals;
  } catch (err) {
    console.error("❌ Error fetching proposals:", err);
    throw err;
  }
};
