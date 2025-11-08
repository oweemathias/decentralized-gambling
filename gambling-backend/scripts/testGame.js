const { ethers } = require("hardhat");
require("dotenv").config();
const chalk = require("chalk");

const GAMES = {
  FIFA: 0,
  POOL: 1,
  CHESS: 2,
};

async function main() {
  const provider = new ethers.JsonRpcProvider(
    `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
  );

  const owner = new ethers.Wallet(process.env.PRIVATE_KEY_OWNER, provider);
  const player1 = new ethers.Wallet(process.env.PRIVATE_KEY_PLAYER1, provider);
  const player2 = new ethers.Wallet(process.env.PRIVATE_KEY_PLAYER2, provider);

  const contractAddress = process.env.CONTRACT_ADDRESS;

  const contractOwner = await ethers.getContractAt("Gambling", contractAddress, owner);
  const contractPlayer1 = await ethers.getContractAt("Gambling", contractAddress, player1);
  const contractPlayer2 = await ethers.getContractAt("Gambling", contractAddress, player2);

  console.log(chalk.blue.bold("\n🎮 Initial Balances:"));
  await logBalances(player1, player2);

  console.log(chalk.yellow("\n💰 Depositing from Player 1..."));
  await contractPlayer1.deposit({ value: ethers.parseEther("0.01") });
  console.log(chalk.green("✅ Player 1 deposited."));

  console.log(chalk.yellow("💰 Depositing from Player 2..."));
  await contractPlayer2.deposit({ value: ethers.parseEther("0.01") });
  console.log(chalk.green("✅ Player 2 deposited."));

  const isP1 = await contractPlayer1.isParticipant(player1.address);
  const isP2 = await contractPlayer2.isParticipant(player2.address);
  console.log(chalk.cyan(`\n🔎 Is Player 1 a participant? ${isP1}`));
  console.log(chalk.cyan(`🔎 Is Player 2 a participant? ${isP2}`));

  console.log(chalk.magenta("\n🎯 Player 1 selecting game..."));
  await contractPlayer1.selectGame("FIFA");
  console.log(chalk.green("✅ Player 1 selected FIFA."));

  console.log(chalk.magenta("🎯 Player 2 selecting game..."));
  await contractPlayer2.selectGame("FIFA");
  console.log(chalk.green("✅ Player 2 selected FIFA."));

  const actualOwner = await contractOwner.owner();
  const ownerAddress = await owner.getAddress();
  console.log(chalk.blue(`\n🆔 Contract Owner (on-chain): ${actualOwner}`));
  console.log(chalk.blue(`🔐 Signer being used: ${ownerAddress}`));

  if (ownerAddress.toLowerCase() !== actualOwner.toLowerCase()) {
    throw new Error(chalk.red("❌ The signer you're using is not the contract owner!"));
  }

  console.log(chalk.yellow("\n🏆 Declaring winner..."));
  const tx = await contractOwner.declareWinner(GAMES.FIFA, player2.address);
  await tx.wait();
  console.log(chalk.green("✅ Winner declared (Player 2)."));

  console.log(chalk.blue.bold("\n📊 Final Balances:"));
  await logBalances(player1, player2);

  console.log(chalk.gray("\n✨ Script completed successfully.\n"));
}

async function logBalances(player1, player2) {
  const balance1 = await player1.provider.getBalance(player1.address);
  const balance2 = await player2.provider.getBalance(player2.address);
  console.log(`👤 Player 1 Balance: ${formatETH(balance1)} ETH`);
  console.log(`👤 Player 2 Balance: ${formatETH(balance2)} ETH`);
}

function formatETH(balanceBigInt) {
  return parseFloat(ethers.formatEther(balanceBigInt)).toFixed(4);
}

main().catch((error) => {
  console.error(chalk.red("❌ Error running script:"), chalk.red(error.message));
  process.exitCode = 1;
});
