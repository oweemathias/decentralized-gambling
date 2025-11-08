// src/helpers/getOpenBetsFor.js
export const getOpenBetsFor = async (contract, viewer) => {
  if (!contract) throw new Error("Contract not available");
  try {
    const [
      indexes,
      proposers,
      stakes,
      gameTypes,
      isConfirmeds,
      hasPendingPairings,
      isOpponents
    ] = await contract.getPendingProposalsFor(viewer);

    const openBets = [];
    for (let i = 0; i < indexes.length; i++) {
      // only those fully confirmed (i.e. paired)
      if (isConfirmeds[i]) {
        openBets.push({
          index: indexes[i].toNumber(),
          proposer: proposers[i],
          stake: stakes[i],
          gameType: gameTypes[i],
          // you can show opponent by looking at `isOpponents`:
          opponent: isOpponents[i] ? viewer : proposers[i],
        });
      }
    }
    return openBets;
  } catch (err) {
    console.error("❌ Error in getOpenBetsFor:", err);
    throw err;
  }
};
