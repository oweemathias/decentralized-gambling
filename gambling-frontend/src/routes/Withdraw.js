// src/routes/Withdraw.js
import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "./WalletContext";
import { parseEther, formatEther } from "ethers";

export default function Withdraw() {
  const { contract, currentAccount } = useContext(WalletContext);
  const [amount, setAmount] = useState("");
  const [availableBalance, setAvailableBalance] = useState("0");
  const [status, setStatus] = useState("");

  const fetchAvailableBalance = async () => {
    if (!contract || !currentAccount) return;

    try {
      let bal;
      if (contract.getBalance) {
        bal = await contract.getBalance(currentAccount);
      } else {
        bal = await contract.balances(currentAccount);
      }
      setAvailableBalance(formatEther(bal));
    } catch (err) {
      console.error("Balance fetch error", err);
      setAvailableBalance("0");
    }
  };

  useEffect(() => {
    fetchAvailableBalance();
  }, [contract, currentAccount]);

  const handleWithdraw = async () => {
    if (!contract) {
      setStatus("⚠️ Connect wallet first");
      return;
    }
    if (!amount) {
      setStatus("⚠️ Enter an amount");
      return;
    }

    let value;
    try {
      value = parseEther(amount);
    } catch {
      setStatus("⚠️ Invalid ETH amount");
      return;
    }

    if (Number(amount) > Number(availableBalance)) {
      setStatus("⚠️ Amount exceeds available balance");
      return;
    }

    try {
      setStatus("⏳ Withdrawing...");
      const tx = await contract.withdrawBalance(value);
      await tx.wait();

      await fetchAvailableBalance(); // refresh balance

      setStatus(`✅ Withdrew ${amount} ETH successfully`);
      setAmount("");
    } catch (err) {
      console.error("Withdraw error:", err);
      const msg =
        err?.reason ||
        err?.error?.message ||
        err?.data?.message ||
        err?.message ||
        "Unknown error";
      setStatus(`❌ Withdrawal failed (${msg})`);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🏧 Withdraw Funds</h2>
      <p>Current account: {currentAccount || "– not connected –"}</p>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Available balance:</strong> {availableBalance} ETH
      </div>

      <div style={{ margin: "1rem 0" }}>
        <input
          type="text"
          placeholder="Amount in ETH"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ marginRight: "0.5rem" }}
        />
        <button onClick={handleWithdraw}>Withdraw</button>
      </div>

      {status && (
        <p>
          <strong>Status:</strong> {status}
        </p>
      )}
    </div>
  );
}
