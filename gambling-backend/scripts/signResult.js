const { ethers } = require("ethers");
require("dotenv").config();

const oraclePrivateKey = process.env.ORACLE_PRIVATE_KEY; // Set this in your .env
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL); // Or your local node
const wallet = new ethers.Wallet(oraclePrivateKey, provider);

async function signMatchResult(player1, player2, winner, gameType, stake) {
  const encoded = ethers.solidityPacked(
    ["address", "address", "address", "string", "uint256"],
    [player1, player2, winner, gameType, stake]
  );

  const hash = ethers.keccak256(encoded);
  const signature = await wallet.signMessage(ethers.getBytes(hash));

  console.log("Signature:", signature);
  return signature;
}

// Example usage
const player1 = "0x..."; // fill in actual
const player2 = "0x..."; // fill in actual
const winner = player1; // or player2
const gameType = "Pool";
const stake = ethers.parseEther("0.01");

signMatchResult(player1, player2, winner, gameType, stake);
