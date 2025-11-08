// src/routes/ProposeMatch.js
import React, { useContext, useState } from "react";
import { WalletContext } from "./WalletContext";
import { parseEther } from "ethers";

const games = ["FIFA", "Pool", "Mortal Kombat", "Chess", "Call of Duty"];

const ProposeMatch = () => {
  const { contract } = useContext(WalletContext);
  const [game, setGame] = useState(games[0]);
  const [stake, setStake] = useState("");
  const [status, setStatus] = useState("");

  const handlePropose = async () => {
    if (!stake) {
      alert("Please enter a stake amount.");
      return;
    }
    if (!contract) {
      setStatus("⚠️ Contract not connected");
      return;
    }

    try {
      const stakeValue = parseEther(stake);

      // 1) Fund your on-chain balance
      setStatus("⏳ Funding contract balance…");
      const fundTx = await contract.fundPlayer({ value: stakeValue });
      await fundTx.wait();

      // 2) Now propose the match
      setStatus("⏳ Placing match proposal…");
      const tx = await contract.proposeMatch(stakeValue, game);
      await tx.wait();

      setStatus(`✅ Match proposed for ${game} with ${stake} ETH`);
      setStake("");
    } catch (err) {
      console.error("Propose match failed:", err);
      const detailedError =
        err?.reason ||
        err?.error?.message ||
        err?.data?.message ||
        err?.message ||
        "Unknown error";
      setStatus(`❌ Failed to propose match (${detailedError})`);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        marginTop: "20px",
      }}
    >
      <select value={game} onChange={(e) => setGame(e.target.value)}>
        {games.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Stake (ETH)"
        value={stake}
        onChange={(e) => setStake(e.target.value)}
      />

      <button onClick={handlePropose}>Propose Match</button>

      {status && <p style={{ marginLeft: "10px" }}>{status}</p>}
    </div>
  );
};

export default ProposeMatch;
