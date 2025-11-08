// src/routes/Deposit.js
import React, { useContext, useState } from "react";
import { WalletContext } from "./WalletContext";
import { parseEther } from "ethers";

export default function Deposit() {
  const { contract, currentAccount } = useContext(WalletContext);
  const [amount, setAmount] = useState("");
  const [status, setStatus]   = useState("");

  const handleDeposit = async () => {
    if (!contract) {
      setStatus("⚠️ Connect wallet & contract first");
      return;
    }
    if (!amount) {
      setStatus("⚠️ Please enter an amount");
      return;
    }

    let value;
    try {
      value = parseEther(amount);
    } catch {
      setStatus("⚠️ Invalid ETH amount");
      return;
    }

    try {
      setStatus("⏳ Depositing...");
      const tx = await contract.fundPlayer({ value });
      await tx.wait();
      setStatus(`✅ Deposited ${amount} ETH successfully`);
      setAmount("");
    } catch (err) {
      console.error("Deposit failed", err);
      const msg =
        err?.reason ||
        err?.error?.message ||
        err?.data?.message ||
        err?.message ||
        "Unknown error";
      setStatus(`Deposit failed ❌ (${msg})`);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>💰 Fund Your Balance</h2>
      <p>Current account: {currentAccount || "– not connected –"}</p>

      <div style={{ margin: "1rem 0" }}>
        <input
          type="text"
          placeholder="Amount in ETH"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ marginRight: "0.5rem" }}
        />
        <button onClick={handleDeposit}>Deposit</button>
      </div>

      {status && (
        <p>
          <strong>Status:</strong> {status}
        </p>
      )}
    </div>
  );
}
