// In-memory storage for proposed matches
const proposedMatches = {};
let matchCounter = 1;

const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
const port = process.env.PORT || 3098;

// ✅ Middleware: Parse JSON request bodies
app.use(express.json());
const oracleRoutes = require("./oracleRoutes");
app.use("/api/oracle", oracleRoutes);

// ======================= FILE UPLOAD SECTION =======================
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer storage for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const { matchId, playerAddress } = req.body;

    // shorten address safely
    const safeAddress = playerAddress ? playerAddress.slice(2, 8) : "unknown";

    // unique traceable filename
    const uniqueName = `${Date.now()}-${matchId}-${safeAddress}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ✅ Upload route (fixed to correctly read formData fields)
app.post("/api/upload-result", upload.single("gameFile"), (req, res) => {
  try {
    const { matchId, playerAddress, gameType } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!playerAddress || !matchId || !gameType) {
      return res.status(400).json({ error: "Missing matchId, playerAddress, or gameType" });
    }

    // ✅ Use the full Ethereum address, lowercase for consistency
    const safeAddress = playerAddress.toLowerCase();

    // ✅ Sanitize gameType (remove spaces or special chars)
    const safeGameType = gameType.replace(/\s+/g, "_");

    // ✅ Construct filename with full address
    const newName = `${Date.now()}-${matchId}-${safeAddress}-${safeGameType}.png`;
    const newPath = path.join(uploadDir, newName);

    // Rename and save file
    fs.renameSync(file.path, newPath);

    console.log(`📸 Received upload from ${safeAddress} for match ${matchId}`);
    console.log("✅ Saved file:", newPath);

    res.status(200).json({
      message: "File uploaded successfully",
      filePath: `http://localhost:3098/uploads/${newName}`,
      matchId,
      playerAddress: safeAddress,
      gameType
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/uploads", (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const uploadDir = path.join(__dirname, "uploads");

  const files = fs.readdirSync(uploadDir).map((filename) => {
    const parts = filename.split("-");
    const fileExt = path.extname(filename);

    // Try to detect Ethereum address (starts with "0x" and 42 chars long)
    const ethAddress = parts.find((p) => p.startsWith("0x") && p.length === 42);

    return {
      filename,
      path: `uploads/${filename}`,
      matchId: parts.find((p) => /^\d+$/.test(p)) || "unknown",
      playerAddress: ethAddress || "unknown",
      gameType: parts[parts.length - 1]?.replace(fileExt, "") || "unknown",
    };
  });

  res.json({ files });
});


// ✅ Fetch uploaded files for a specific match
app.get("/api/get-uploads/:matchId", (req, res) => {
  const matchId = req.params.matchId;

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("Error reading upload directory:", err);
      return res.status(500).json({ error: "Failed to read uploads folder" });
    }

    const matchFiles = files.filter((f) => f.includes(`-${matchId}-`));

    if (matchFiles.length === 0) {
      return res.status(200).json({ message: "No files found for this match" });
    }

    res.json({
      matchId,
      files: matchFiles.map((f) => `http://localhost:${port}/uploads/${f}`)
    });
  });
});

// ✅ REPLACED: List all uploaded files, grouped by matchId
app.get("/api/uploads/grouped", (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);

    // Parse filenames like: "1730200000000-1-e10687-screenshot.png"
    const allUploads = files.map((file) => {
      const parts = file.split("-");
      const timestamp = parts[0];
      const matchId = parts[1] || "unknown";
      const playerFragment = parts[2] || "unknown";

      return {
        filePath: `http://localhost:${port}/uploads/${file}`,
        matchId,
        playerFragment,
        fileName: file,
      };
    });

    // Group by matchId and reconstruct player info
    const grouped = {};
    allUploads.forEach((u) => {
      if (!grouped[u.matchId]) {
        grouped[u.matchId] = {
          matchId: u.matchId,
          gameType: "FIFA", // static for now
          players: [],
        };
      }

      grouped[u.matchId].players.push({
        playerAddress: `0x${u.playerFragment}...`,
        filePath: u.filePath,
      });
    });

    res.json(Object.values(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list uploads" });
  }
});

// ✅ Serve static uploaded files (for OraclePanel)
app.use("/uploads", express.static(uploadDir));

// ======================= MATCH MANAGEMENT =======================

// ✅ Propose a match
app.post("/propose", async (req, res) => {
  try {
    const { gameType, stake, opponent, proposer } = req.body;

    if (!gameType || !stake || !opponent || !proposer) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const matchId = matchCounter++;

    const newMatch = {
      matchId,
      gameType,
      stake,
      proposer,
      opponent,
      confirmed: false,
      createdAt: new Date().toISOString(),
    };

    proposedMatches[matchId] = newMatch;

    console.log(`🎮 New match proposed with Match ID: ${matchId}`);

    res.status(201).json({
      message: "Match proposed successfully",
      match: newMatch,
    });
  } catch (error) {
    console.error("Error proposing match:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Confirm a match
app.post("/confirm", async (req, res) => {
  try {
    const { matchId, confirmer } = req.body;

    if (!matchId || !confirmer) {
      return res.status(400).json({ error: "Missing matchId or confirmer" });
    }

    const match = proposedMatches[matchId];
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    if (match.opponent.toLowerCase() !== confirmer.toLowerCase()) {
      return res.status(403).json({ error: "Only opponent can confirm" });
    }

    match.confirmed = true;

    console.log(`✅ Match ${matchId} confirmed`);

    res.status(200).json({
      message: "Match confirmed",
      match,
    });
  } catch (error) {
    console.error("Error confirming match:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ======================= BLOCKCHAIN SECTION =======================
const { ethers } = require("ethers");
require("dotenv").config();

const CONTRACT_ABI = require("./artifacts/contracts/Gambling.sol/Gambling.json").abi;
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

console.log("✅ Contract initialized successfully on Sepolia");

// ✅ Declare Winner Route
app.post("/api/game-result", async (req, res) => {
  let { matchId, winner } = req.body;

  // Normalize address
  if (winner && !winner.startsWith("0x")) {
    winner = "0x" + winner;
  }

  if (!matchId || !winner) {
    return res.status(400).json({ error: "Missing matchId or winner" });
  }

  try {
    // 🔹 Step 1: Load oracle wallet (must match oracleSigner in contract)
    const oraclePrivateKey = process.env.ORACLE_PRIVATE_KEY;
    const oracleWallet = new ethers.Wallet(oraclePrivateKey, provider);

    // 🔹 Step 2: Fetch proposal data from contract
    const p = await contract.pendingProposals(matchId);
    const proposer = p.proposer;
    const opponent = p.opponent;
    const stake = p.stake;
    const gameType = p.gameType;

    console.log("Fetched match data:", { proposer, opponent, stake, gameType });

    // 🔹 Step 3: Recreate message hash
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "address", "uint256", "string", "address"],
      [matchId, proposer, opponent, winner, stake, gameType, contract.target]
    );

    const arrayifiedHash = ethers.getBytes(messageHash);

    // 🔹 Step 4: Sign hash with oracle private key
    const signature = await oracleWallet.signMessage(arrayifiedHash);

    console.log(`🪶 Generated signature: ${signature.slice(0, 20)}...`);

    // 🔹 Step 5: Call declareWinner() with real signature
    console.log(`🧾 Received matchId from frontend:`, matchId);
    const tx = await contract.declareWinner(matchId, winner, signature);
    await tx.wait();

    console.log("✅ Winner declared successfully!");
    res.status(200).json({
      message: "Winner declared successfully",
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("❌ Error declaring winner:", err);
    res.status(500).json({
      error: "Failed to declare winner",
      details: err.message,
    });
  }
});
// ✅ Simulated AI Evaluation Route
app.post("/api/ai-evaluate", async (req, res) => {
  try {
    console.log("🤖 AI evaluation request received.");

    // 1️⃣ Fetch all uploaded files
    const files = fs.readdirSync(uploadDir);
    if (files.length === 0) {
      return res.status(200).json({
        message: "No uploaded results available for AI analysis.",
        aiResults: [],
      });
    }

    // 2️⃣ Simulate “AI confidence” scoring
    const aiResults = files.map((filename) => {
      const parts = filename.split("-");
      const matchId = parts[1] || "unknown";
      const ethAddress =
        parts.find((p) => p.startsWith("0x") && p.length === 42) || "unknown";

      // Generate a fake AI confidence between 70–99%
      const confidence = (Math.random() * 0.29 + 0.7).toFixed(2);

      return {
        matchId,
        playerAddress: ethAddress,
        confidence: Number(confidence),
        result: confidence > 0.85 ? "likely winner" : "uncertain",
        file: filename,
      };
    });

    // 3️⃣ Log and return
    console.log("🤖 AI simulated evaluation complete:", aiResults.length, "files analyzed.");
    res.status(200).json({
      message: "AI evaluation simulated successfully.",
      aiResults,
    });
  } catch (err) {
    console.error("❌ AI evaluation failed:", err);
    res.status(500).json({
      error: "AI evaluation simulation failed.",
      details: err.message,
    });
  }
});

// ---------- START SERVER ----------
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});