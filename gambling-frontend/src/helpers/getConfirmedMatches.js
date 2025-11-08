// src/helpers/getConfirmedMatches.js
export const getConfirmedMatches = async (contract) => {
  if (!contract) throw new Error("Contract not available");
  try {
    // returns MatchProposal[] where isConfirmed === true
    const confirmed = await contract.getConfirmedMatches();
    return confirmed.map((p, i) => ({
      matchIndex: i,
      player1: p.proposer,
      player2: p.opponent,
      stake: p.stake,
      gameType: p.gameType,
    }));
  } catch (e) {
    console.error("Error fetching confirmed matches", e);
    throw e;
  }
};
