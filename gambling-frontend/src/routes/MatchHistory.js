// src/routes/MatchHistory.js
import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "./WalletContext";
import { formatEther } from "ethers";

const safeFormatEther = (value) => {
  try {
    return value ? formatEther(value) : "0";
  } catch {
    return "0";
  }
};

const MatchHistory = () => {
  const { contract } = useContext(WalletContext);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!contract) return;

    const fetch = async () => {
      try {
        const data = await contract.getMatchHistory();
        console.log("RAW MATCH HISTORY:", data);
        setMatches(data);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetch();
  }, [contract]);

  return (
    <div>
      <h2>📜 Match History</h2>
      {matches.length === 0 ? (
        <p>No matches played yet.</p>
      ) : (
        <ul>
          {matches.map((m, i) => (
            <li key={i}>
              <strong>Game:</strong> {m.game} |{" "}
              <strong>Winner:</strong> {m.winner?.slice(0, 10)}... |{" "}
              <strong>Stake:</strong> {safeFormatEther(m.stake)} ETH
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MatchHistory;
