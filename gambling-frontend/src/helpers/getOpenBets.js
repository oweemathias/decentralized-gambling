// src/helpers/getOpenBets.js
export const getOpenBets = async (contract) => {
  if (!contract) throw new Error("Contract not available");
  try {
    // confirmed but not yet in history
    const proposals = await contract.getConfirmedMatches();
    // returns MatchProposal[], same shape as before
    return proposals.map((p, i) => ({
      id: i,
      proposer: p.proposer,
      opponent: p.opponent,
      gameType: p.gameType,
      stake: p.stake,
    }));
  } catch (err) {
    console.error("Error fetching open bets:", err);
    throw err;
  }
};
