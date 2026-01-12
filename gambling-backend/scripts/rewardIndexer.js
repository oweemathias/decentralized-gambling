import { ethers } from "ethers";
import dotenv from "dotenv";
import gamblingABI from "../artifacts/contracts/Gambling.sol/Gambling.json" assert { type: "json" };

dotenv.config();

const RPC_URL = process.env.RPC_URL;
const OWNER_KEY = process.env.OWNER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const ownerWallet = new ethers.Wallet(OWNER_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, gamblingABI.abi, ownerWallet);

// VERY SIMPLE IN-MEMORY STORE (replace with DB later)
const points = {};
const rewarded = {};

const POINTS_THRESHOLD = 10;
const REWARD_AMOUNT = ethers.parseEther("0.001");

function addPoints(user, amount) {
  if (!points[user]) points[user] = 0;
  points[user] += amount;
  console.log(`⭐ ${user} now has ${points[user]} points`);
}

async function maybeReward(user) {
  if (points[user] >= POINTS_THRESHOLD && !rewarded[user]) {
    console.log(`🎁 Rewarding ${user}`);

    const tx = await contract.grantReward(
      user,
      REWARD_AMOUNT,
      "LOYALTY_REWARD"
    );
    await tx.wait();

    rewarded[user] = true;
    points[user] = 0;
  }
}

async function start() {
  console.log("🚀 Reward indexer started");

  contract.on("PlayerFunded", async (user, amount) => {
    addPoints(user, 1);
    await maybeReward(user);
  });

  contract.on("ProposalCreated", async (_, proposer) => {
    addPoints(proposer, 2);
    await maybeReward(proposer);
  });

  contract.on("WinnerDeclared", async (_, winner) => {
    addPoints(winner, 5);
    await maybeReward(winner);
  });
}

start();
