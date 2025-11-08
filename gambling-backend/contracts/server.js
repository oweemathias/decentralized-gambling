const express = require("express");
const { ethers } = require("ethers");
const app = express();
const port = 3098;

app.use(express.json());

// Connect to the local Hardhat network
const provider = new ethers.JsonRpcProvider("http://localhost:8545");

// Use the private key for the deployer account
const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Owner's private key
const wallet = new ethers.Wallet(privateKey, provider);

// Use the deployed contract address
const contractAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"; // Replace with your deployed contract address

// ABI for the Gambling contract
const contractABI = [
    "function declareWinner(uint256 gameId, address winner) public"
];

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Test endpoint
app.get('/api/test', (req, res) => {
    res.status(200).send('Backend is working!');
});

// API endpoint to receive game results
app.post('/api/game-result', async (req, res) => {
    console.log("Received request at /api/game-result");
    const { score, time, playerName } = req.body;

    try {
        // Validate the playerName as a valid Ethereum address
        if (!ethers.isAddress(playerName)) {
            throw new Error("Invalid Ethereum address");
        }

        // Convert the playerName to a checksummed address
        const checksummedWinnerId = ethers.getAddress(playerName);
        console.log(`Game results - Score: ${score}, Time: ${time}, Winner: ${checksummedWinnerId}`);

        // Call the declareWinner function in the smart contract
        const tx = await contract.declareWinner(1, checksummedWinnerId); // Replace 1 with actual gameId if needed
        console.log("Transaction sent:", tx.hash);

        await tx.wait();
        console.log("Transaction confirmed:", tx.hash);

        res.status(200).send('Winner declared on blockchain');
    } catch (error) {
        console.error("Error declaring winner:", error);
        res.status(500).send(`Error declaring winner: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});