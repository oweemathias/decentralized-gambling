const hre = require("hardhat");

async function main() {
  console.log("Getting contract...");

  const Gambling = await hre.ethers.getContractFactory("Gambling");

  console.log("Deploying contract...");
  const gambling = await Gambling.deploy();

  await gambling.waitForDeployment();

  const contractAddress = await gambling.getAddress();
  console.log("Gambling deployed to:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
