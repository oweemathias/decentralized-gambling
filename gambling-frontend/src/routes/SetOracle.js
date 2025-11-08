// src/routes/SetOracle.js
import React, { useState, useContext } from "react";
import { WalletContext } from "./WalletContext";

export default function SetOracle() {
  const { contract } = useContext(WalletContext);
  const [newOracle, setNewOracle] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const updateOracle = async () => {
    if (!newOracle) {
      setStatus("⚠️ Enter a valid address");
      return;
    }

    try {
      setLoading(true);
      setStatus("⏳ Updating oracle...");
      const tx = await contract.setOracleSigner(newOracle);
      await tx.wait();
      setStatus("✅ Oracle signer updated successfully!");
    } catch (err) {
      console.error(err);
      setStatus(`❌ ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded-2xl space-y-4">
      <h2 className="text-xl font-semibold">⚙️ Set Oracle Signer</h2>
      <input
        placeholder="New Oracle Address"
        className="w-full border rounded-lg p-2"
        value={newOracle}
        onChange={(e) => setNewOracle(e.target.value)}
      />
      <button
        onClick={updateOracle}
        disabled={loading}
        className={`w-full py-2 rounded-lg text-white ${
          loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {loading ? "Updating..." : "Update Oracle"}
      </button>
      {status && <p className="text-center">{status}</p>}
    </div>
  );
}
