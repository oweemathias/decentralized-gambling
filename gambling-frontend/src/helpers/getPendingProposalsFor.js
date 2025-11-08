// src/helpers/getPendingProposals.js
export const getPendingProposals = async (contract, viewer) => {
  if (!contract) throw new Error("Contract not available");
  if (!viewer) throw new Error("Viewer address is missing");

  try {
    // ✅ Fetch all proposal arrays from contract
    const result = await contract.getPendingProposalsFor(viewer);

    if (!Array.isArray(result) || result.length < 7) {
      throw new Error(
        "Unexpected contract return format for getPendingProposalsFor()"
      );
    }

    const [
      indexes,
      proposers,
      stakes,
      gameTypes,
      isConfirmeds,
      hasPendingPairings,
      isOpponents,
    ] = result;

    const proposals = [];

    for (let i = 0; i < indexes.length; i++) {
      try {
        if (!isConfirmeds[i]) {
          const matchProposalIndex = Number(indexes[i]);
          const proposer = (proposers[i] || "").toLowerCase();
          const stake = Number(stakes[i] || 0);
          const gameType = gameTypes[i] || "Unknown";

          proposals.push({
            matchProposalIndex,
            proposer,
            stake,
            gameType,
            isConfirmed: Boolean(isConfirmeds[i]),
            hasPendingPairing: Boolean(hasPendingPairings[i]),
            isOpponent: Boolean(isOpponents[i]),
            isProposer: false,
            isChallenger: false,
          });
        }
      } catch (err) {
        console.warn("⚠️ Failed to parse proposal at index", i, err);
      }
    }

    // 🧩 EXTRA: Cross-check pairingRequests for both viewer & proposer
    for (const p of proposals) {
      try {
        // 1️⃣ Check viewer's pairing request (viewer is challenger)
        const viewerReq = await contract.pairingRequests(viewer);
        if (
          viewerReq?.isPending &&
          Number(viewerReq.matchProposalIndex) === Number(p.matchProposalIndex)
        ) {
          p.hasPendingPairing = true;
          p.isChallenger = true;
        }

        // 2️⃣ Check proposer's pairing request (proposer is waiting)
        const proposerReq = await contract.pairingRequests(p.proposer);
        if (
          proposerReq?.isPending &&
          Number(proposerReq.matchProposalIndex) === Number(p.matchProposalIndex) &&
          p.proposer !== viewer.toLowerCase()
        ) {
          p.hasPendingPairing = true;
          p.isProposer = true;
        }
      } catch (err) {
        console.warn(`⚠️ Pairing request check failed for ${p.proposer}:`, err);
        p.hasPendingPairing = Boolean(p.hasPendingPairing);
        p.isProposer = Boolean(p.isProposer);
        p.isChallenger = Boolean(p.isChallenger);
      }
    }

    console.log("✅ Normalized proposals (final):", proposals);
    return proposals;
  } catch (err) {
    console.error("❌ Error fetching proposals:", err);
    throw err;
  }
};