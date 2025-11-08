require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
const port = 3098;

app.use(express.json());
app.use(cors());

// Load environment variables
const privateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;
const rpcUrl = process.env.RPC_URL || "https://goerli.infura.io/v3/YOUR_INFURA_PROJECT_ID";

if (!privateKey) {
    console.error("Error: PRIVATE_KEY is missing from environment variables.");
    process.exit(1);
}
if (!contractAddress) {
    console.error("Error: CONTRACT_ADDRESS is missing from environment variables.");
    process.exit(1);
}

// Connect to Goerli blockchain
const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

// ABI for the Gambling contract
const contractABI = [
    "function declareWinner(uint256 gameId, address winner) external"
];

// Initialize contract
const contract = new ethers.Contract(contractAddress, contractABI, wallet);
console.log("Contract initialized successfully on Goerli");

// Test endpoint
app.get("/api/test", (req, res) => {
    res.status(200).send("Backend is working on Goerli!");
});

// API endpoint to receive game results
app.post("/api/game-result", async (req, res) => {
    try {
        console.log("Received request at /api/game-result:", req.body);

        const { gameId, winner } = req.body;
        if (!gameId || !winner) {
            return res.status(400).json({ error: "Missing gameId or winner address" });
        }

        console.log(`Declaring winner for game ID: ${gameId}, Winner: ${winner}`);

        // Call contract function
        const tx = await contract.declareWinner(gameId, winner);
        await tx.wait();

        console.log("Transaction successful:", tx.hash);
        res.status(200).json({ message: "Winner declared successfully", txHash: tx.hash });

    } catch (error) {
        console.error("Error processing game result:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
