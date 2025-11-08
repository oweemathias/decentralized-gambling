// src/routes/MatchHistory.js
import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "./WalletContext";
import { formatEther } from "ethers";

const MatchHistory = () => {
  const { contract } = useContext(WalletContext);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await contract.getMatchHistory();
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
              <strong>Winner:</strong> {m.winner.slice(0, 10)}... |{" "}
              <strong>Stake:</strong> {formatEther(m.stakeAmount)} ETH
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MatchHistory;
