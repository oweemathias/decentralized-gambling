const hre = require("hardhat");

async function main() {
    // Get the contract factory
    const Gambling = await hre.ethers.getContractFactory("Gambling");

    // Attach to the deployed contract
    const contractAddress = "0x5FbDB2315678afecb367f032d93F6d2f6d180aa3"; // Replace with your deployed contract address
    const gambling = await Gambling.attach(contractAddress);

    // Declare a winner
    const gameId = 1;
    const winner = ethers.getAddress("0xE9E2B02B046a63B976248677f2C237f747D668aa"); // Valid checksummed address
    console.log("Checksummed winner address:", winner);

    const tx = await gambling.declareWinner(gameId, winner);
    await tx.wait();

    console.log("Winner declared for game ID:", gameId);

    // Get the winner
    const declaredWinner = await gambling.getWinner(gameId);
    console.log("Winner for game ID", gameId, "is:", declaredWinner);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });