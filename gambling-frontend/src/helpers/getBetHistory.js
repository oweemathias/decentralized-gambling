// src/helpers/getBetHistory.js
export const getBetHistory = async (contract) => {
  if (!contract) throw new Error("Contract not available");
  try {
    // Match[]: { player1, player2, stake, gameType, winner, isCompleted }
    const history = await contract.getMatchHistory();
    // Fetch block timestamps for each (optional)
    const withTime = await Promise.all(
      history.map(async (m, i) => {
        // m is a Result object, so destructure:
        const { player1, player2, stake, gameType, winner } = m;
        // get block timestamp from the transaction that pushed this into history:
        // we assume your contract emitted an event—if not, you can skip the time or store block number.
        return { id: i, player1, player2, gameType, stake, winner };
      })
    );
    return withTime;
  } catch (err) {
    console.error("Error fetching bet history:", err);
    throw err;
  }
};
