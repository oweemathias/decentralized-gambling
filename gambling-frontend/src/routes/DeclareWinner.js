// src/routes/DeclareWinner.js
import React, { useContext, useState, useEffect } from "react";
import { WalletContext } from "./WalletContext";

export default function UploadResult() {
  const { currentAccount } = useContext(WalletContext);
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [gameType, setGameType] = useState("");
  const [matchId, setMatchId] = useState("");
  const [activeAccount, setActiveAccount] = useState("");

  // ✅ Always detect and sync the current MetaMask account
  useEffect(() => {
    async function fetchAccount() {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) setActiveAccount(accounts[0]);
      }
    }

    fetchAccount();

    // Listen for account change
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setActiveAccount(accounts[0]);
          window.location.reload(); // ensure UI refreshes for new wallet
        }
      });
    }
  }, []);

  const uploadFile = async () => {
    let playerAddress = activeAccount || currentAccount;
    if (playerAddress && !playerAddress.startsWith("0x")) {
      playerAddress = "0x" + playerAddress;
    }

    if (!file || !matchId || !gameType || !playerAddress) {
      setUploadStatus("⚠️ Please connect wallet and fill all fields");
      return;
    }

    const formData = new FormData();
    formData.append("gameFile", file);
    formData.append("matchId", matchId);
    formData.append("playerAddress", playerAddress);
    formData.append("gameType", gameType);

    try {
      setUploadStatus("⏳ Uploading...");
      const res = await fetch("http://localhost:3098/api/upload-result", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`✅ Uploaded successfully. File: ${data.filePath}`);
      } else {
        setUploadStatus(`❌ Upload failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setUploadStatus("❌ Upload failed");
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-2xl space-y-6">
      <h2 className="text-2xl font-semibold text-center">📤 Submit Match Result</h2>

      <p className="text-center text-gray-600 text-sm">
        Connected Wallet:{" "}
        <span className="font-mono text-blue-600">
          {activeAccount || currentAccount || "Not connected"}
        </span>
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">🕹️ Game Type</label>
        <input
          className="w-full border border-gray-300 rounded-lg p-2"
          value={gameType}
          onChange={(e) => setGameType(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">🎮 Match ID</label>
        <input
          className="w-full border border-gray-300 rounded-lg p-2"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">📸 Upload Game Result</label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full border border-gray-300 rounded-lg p-2"
        />
      </div>

      <button
        onClick={uploadFile}
        className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
      >
        Upload
      </button>

      {uploadStatus && <p className="text-center text-gray-700 mt-2">{uploadStatus}</p>}
    </div>
  );
}
