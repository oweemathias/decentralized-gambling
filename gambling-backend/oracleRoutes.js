// backend/oracleRoutes.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

const uploadDir = path.join(__dirname, "uploads");

// Temporary in-memory database for uploads
let uploadedResults = [];

// ✅ Blockchain setup
const CONTRACT_ABI = require("./artifacts/contracts/Gambling.sol/Gambling.json").abi;
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const oracleKey = process.env.ORACLE_PRIVATE_KEY;

let oracleWallet = null;
let contract = null;

if (oracleKey) {
  oracleWallet = new ethers.Wallet(oracleKey, provider);
  contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, oracleWallet);
  console.log("🧠 Oracle wallet connected to contract:", oracleWallet.address);
} else {
  console.warn("⚠️ ORACLE_PRIVATE_KEY missing in .env");
}

// ✅ Get all uploads for OraclePanel.js
router.get("/results", (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    uploadedResults = files.map((file, index) => ({
      id: index + 1,
      filename: file,
      filePath: `/uploads/${file}`,
      player: "Unknown",
      gameId: "Unspecified",
      status: "pending",
    }));
    res.json(uploadedResults);
  } catch (err) {
    console.error("Error listing uploads:", err);
    res.status(500).json({ error: "Failed to list uploads" });
  }
});

// ✅ Declare a winner locally (no blockchain, fallback)
router.post("/declare", (req, res) => {
  const { id, winner } = req.body;
  const match = uploadedResults.find((m) => m.id === Number(id));

  if (!match) return res.status(404).json({ error: "Result not found" });

  match.status = "verified";
  match.winner = winner;

  console.log(`✅ Local winner declared for file: ${match.filename}`);
  res.json({ message: "Winner declared successfully (local)", data: match });
});

// ✅ Declare winner on-chain (real blockchain call)
router.post("/declare-winner", async (req, res) => {
  const { matchId, winner } = req.body;

  if (!oracleWallet || !contract) {
    return res.status(400).json({ error: "⚠️ Oracle private key missing in .env" });
  }

  if (!matchId || !winner) {
    return res.status(400).json({ error: "Missing matchId or winner address" });
  }

  try {
    console.log(`🧠 Oracle declaring on-chain winner for match ${matchId}: ${winner}`);

    const tx = await contract.declareWinner(matchId, winner);
    await tx.wait();

    console.log(`✅ On-chain winner declared! Tx: ${tx.hash}`);

    res.json({
      message: "Winner declared successfully on-chain",
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("❌ Oracle declare error:", err);
    res.status(500).json({
      error: "Failed to declare winner on-chain",
      details: err.message,
    });
  }
});

module.exports = router;
