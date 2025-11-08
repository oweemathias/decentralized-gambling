const hre = require("hardhat");

async function main() {
    // Get the contract factory
    const Gambling = await hre.ethers.getContractFactory("Gambling");

    // Deploy the contract
    const gambling = await Gambling.deploy();

    // Wait for the contract to be deployed
    await gambling.waitForDeployment();

    // Get the contract address
    const contractAddress = await gambling.getAddress();

    // Log the contract address
    console.log("Gambling deployed to:", contractAddress);
}

// Run the deployment
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});