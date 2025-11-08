// src/helpers/getMatchHistory.js
export const getMatchHistory = async (contract) => {
  if (!contract) throw new Error("Contract not available");
  try {
    // returns Match[] (completed matches)
    const history = await contract.getMatchHistory();
    return history.map((m, i) => ({
      idx: i,
      player1: m.player1,
      player2: m.player2,
      stake: m.stake,
      gameType: m.gameType,
      winner: m.winner,
    }));
  } catch (e) {
    console.error("Error fetching match history", e);
    throw e;
  }
};
