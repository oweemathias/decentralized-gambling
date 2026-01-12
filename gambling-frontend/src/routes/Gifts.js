// src/routes/Gifts.js
import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "./WalletContext";
import { formatEther, parseEther } from "ethers";

export default function Gifts() {
  const { contract, currentAccount } = useContext(WalletContext);

  const [rewardBalance, setRewardBalance] = useState("0");
  const [rewards, setRewards] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimAmount, setClaimAmount] = useState("");

  useEffect(() => {
    if (!contract || !currentAccount) return;

    const loadRewards = async () => {
      setLoading(true);
      try {
        /* 1️⃣ Reward balance */
        const bal = await contract.balances(currentAccount);
        setRewardBalance(formatEther(bal));

        /* 2️⃣ Reward history */
        const events = await contract.queryFilter(
          contract.filters.RewardGranted(currentAccount),
          0,
          "latest"
        );

        const provider = contract.provider;

        const history = await Promise.all(
          events.map(async (e) => {
            const block = await provider.getBlock(e.blockNumber);
            return {
              kind: e.args.kind,
              amount: formatEther(e.args.amount),
              time: new Date(block.timestamp * 1000).toLocaleString(),
              txHash: e.transactionHash,
            };
          })
        );

        /* 3️⃣ Build summary by reward kind */
        const totals = {};
        history.forEach((r) => {
          totals[r.kind] = (totals[r.kind] || 0) + Number(r.amount);
        });

        Object.keys(totals).forEach(
          (k) => (totals[k] = totals[k].toFixed(6))
        );

        setSummary(totals);
        setRewards(history.reverse());
      } catch (err) {
        console.error("Failed to load rewards:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRewards();
  }, [contract, currentAccount]);

  /* 🪙 Claim rewards (partial or full) */
  const claimRewards = async () => {
    try {
      setWithdrawing(true);

      const amount =
        claimAmount && Number(claimAmount) > 0
          ? parseEther(claimAmount)
          : parseEther(rewardBalance);

      const tx = await contract.withdrawBalance(amount);
      await tx.wait();

      alert("Rewards claimed successfully 🎉");
      setShowClaimModal(false);
      setClaimAmount("");
    } catch (err) {
      console.error("Claim failed:", err);
      alert("Claim failed");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 520 }}>
      <h2>🎁 Gifts & Rewards</h2>

      {loading ? (
        <p>Loading rewards...</p>
      ) : (
        <>
          {/* ===== Reward Balance ===== */}
          <div
            style={{
              background: "#111",
              color: "#fff",
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <h4>Available Rewards</h4>
            <div style={{ fontSize: 26, margin: "8px 0" }}>
              {rewardBalance} ETH
            </div>

            <button
              onClick={() => setShowClaimModal(true)}
              disabled={rewardBalance === "0"}
              style={{ padding: "8px 16px" }}
            >
              Claim Rewards
            </button>
          </div>

          {/* ===== Reward Summary ===== */}
          {Object.keys(summary).length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {Object.entries(summary).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    flex: 1,
                    background: "#1a1a1a",
                    padding: 10,
                    borderRadius: 6,
                    textAlign: "center",
                    color: "#fff",
                  }}
                >
                  <small>{k.toUpperCase()}</small>
                  <div>{v} ETH</div>
                </div>
              ))}
            </div>
          )}

          {/* ===== Reward History ===== */}
          <h4>📜 Reward History</h4>

          {rewards.length === 0 ? (
            <p>No rewards yet.</p>
          ) : (
            rewards.map((r, i) => (
              <div
                key={i}
                style={{
                  background: "#1a1a1a",
                  color: "#fff",
                  padding: 12,
                  borderRadius: 6,
                  marginBottom: 10,
                }}
              >
                <strong>{r.kind}</strong>
                <div>{r.amount} ETH</div>
                <small>{r.time}</small>
              </div>
            ))
          )}
        </>
      )}

      {/* ===== Claim Modal ===== */}
      {showClaimModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#111",
              color: "#fff",
              padding: 20,
              borderRadius: 10,
              width: 320,
            }}
          >
            <h3>🎁 Claim Rewards</h3>
            <p>Available: {rewardBalance} ETH</p>

            <input
              type="number"
              placeholder="Amount (leave empty = all)"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              style={{ width: "100%", padding: 8, marginBottom: 12 }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={claimRewards}
                disabled={withdrawing}
                style={{ flex: 1 }}
              >
                {withdrawing ? "Claiming..." : "Confirm"}
              </button>
              <button
                onClick={() => setShowClaimModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
