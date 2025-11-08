// src/helpers/getPairingRequest.js
export const getPairingRequest = async (contract, viewer) => {
  if (!contract || !viewer) return null;
  try {
    const r = await contract.pairingRequests(viewer);
    return {
      matchProposalIndex: r[0].toNumber(),
      proposer:           r[1],
      opponent:           r[2],
      gameType:           r[3],
      isAccepted:         r[4],
      isPending:          r[5],
    };
  } catch {
    return null;
  }
};
