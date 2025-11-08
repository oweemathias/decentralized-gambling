// backend/routes/submitResult.js
const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
require("dotenv").config();

const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const wallet = new ethers.Wallet(PRIVATE_KEY);

let pendingMatches = {}; // store in memory for now (use DB in production)

/**
 * POST /submit-result
 * {
 *   matchId: "1",
 *   winner: "0x123..."
 * }
 */
router.post("/", async (req, res) => {
  try {
    const { matchId, winner } = req.body;

    if (!matchId || !winner) {
      return res.status(400).json({ error: "matchId and winner are required." });
    }

    // Sign the result message
    const message = ethers.utils.solidityKeccak256(["uint256", "address"], [matchId, winner]);
    const signature = await wallet.signMessage(ethers.utils.arrayify(message));

    // Save match result to memory
    pendingMatches[matchId] = { winner, signature };

    console.log(`✅ Match ${matchId} signed result ready.`);

    res.json({
      matchId,
      winner,
      signature,
      oracle: wallet.address
    });
  } catch (err) {
    console.error("❌ Error submitting result:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// For testing or Chainlink Automation to read pending matches
router.get("/pending", (req, res) => {
  res.json(pendingMatches);
});

module.exports = router;
