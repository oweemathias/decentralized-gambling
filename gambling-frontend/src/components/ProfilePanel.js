import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "../routes/WalletContext";
import { formatEther } from "ethers";
import { useNavigate } from "react-router-dom";

export default function ProfilePanel({ onClose }) {
  const { contract, currentAccount } = useContext(WalletContext);
  const [balance, setBalance] = useState("0");
  const navigate = useNavigate();

  useEffect(() => {
    if (!contract || !currentAccount) return;

    const loadBalance = async () => {
      try {
        let bal;

        if (typeof contract.getBalance === "function") {
          bal = await contract.getBalance(currentAccount);
        } else if (typeof contract.balances === "function") {
          bal = await contract.balances(currentAccount);
        } else {
          console.warn("No balance method found on contract");
          return;
        }

        if (bal != null) {
          setBalance(formatEther(bal));
        }
      } catch (err) {
        console.error("Failed to load balance:", err);
      }
    };

    loadBalance();
  }, [contract, currentAccount]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 300,
        height: "100%",
        background: "#111",
        color: "#fff",
        padding: 20,
        zIndex: 1000
      }}
    >
      <button onClick={onClose}>✖</button>

      <h3>User Profile</h3>

      <p style={{ fontSize: 12 }}>
        {currentAccount
          ? currentAccount.slice(0, 6) + "..." + currentAccount.slice(-4)
          : "Not connected"}
      </p>

      <hr />

      <div>
        <strong>Available balance</strong>
        <p style={{ fontSize: 20 }}>{balance} ETH</p>
      </div>

      <hr />

      <button
        style={{ width: "100%" }}
        onClick={() => {
          onClose();
          navigate("/deposit");
        }}
      >
        💰 Deposit
      </button>

      <button
        style={{ width: "100%", marginTop: 5 }}
        onClick={() => {
          onClose();
          navigate("/withdraw");
        }}
      >
        🏧 Withdraw
      </button>

      <hr />

      <small
        style={{ cursor: "pointer" }}
        onClick={() => {
          onClose();
          navigate("/history");
        }}
      >
        📜 Bet History
      </small>
      <br />


      <small
        style={{ cursor: "pointer" }}
        onClick={() => {
          onClose();
          navigate("/transactions");
        }}
      >
        🔄 Transactions
      </small>
      <br />

       <small
        style={{ cursor: "pointer" }}
        onClick={() => {
          onClose();
          navigate("/Gifts");
        }}
      >
        🎁 Gifts & Rewards
      </small>
      <br />
    </div>
  );
}
