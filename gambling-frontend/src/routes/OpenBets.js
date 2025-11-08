// src/routes/OpenBets.js
import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "./WalletContext";
import { formatEther } from "ethers";

export default function OpenBets() {
  const { contract, currentAccount } = useContext(WalletContext);
  const [tab, setTab] = useState("open");
  const [openBets, setOpenBets] = useState([]);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("");

  // ✅ Fetch confirmed (paired) matches for both proposer and opponent
  const loadOpenBets = async () => {
    if (!contract || !currentAccount) return;
    setStatus("🔄 Loading open bets…");

    try {
      const [
        idxs,
        proposers,
        stakes,
        gameTypes,
        isConfirmeds,
        hasReq,
        isOpp,
      ] = await contract.getConfirmedProposalsFor(currentAccount);

      const arr = [];

      for (let i = 0; i < idxs.length; i++) {
        const matchId = Number(idxs[i]);
        const matchData = await contract.pendingProposals(matchId);

        // Skip any invalid or empty matches
        if (!matchData.proposer || matchData.proposer === "0x0000000000000000000000000000000000000000")
          continue;

        arr.push({
          matchId,
          proposer: matchData.proposer,
          opponent: matchData.opponent,
          stake: matchData.stake,
          gameType: matchData.gameType,
          isOpponent: isOpp[i],
        });
      }

      if (arr.length > 0) {
        setOpenBets(arr);
        setStatus(`✅ ${arr.length} open bet(s) found`);
      } else {
        setOpenBets([]);
        setStatus("ℹ️ No open bets found for this account.");
      }
    } catch (e) {
      console.error("Error loading open bets:", e);
      setStatus("❌ Failed to load open bets");
    }
  };

  // ✅ Fetch match history (completed via declareWinner)
  const loadHistory = async () => {
    if (!contract) return;
    setStatus("🔄 Loading bet history…");
    try {
      const mh = await contract.getMatchHistory();
      setHistory(mh);
      setStatus(`✅ ${mh.length} past bet(s)`);
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed to load bet history");
    }
  };

  useEffect(() => {
    if (!contract) return;
    if (tab === "open") loadOpenBets();
    else loadHistory();
  }, [contract, currentAccount, tab]);

  return (
    <div style={{ padding: 20 }}>
      <h2>📊 Open Bets & History</h2>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setTab("open")}
          style={{
            marginRight: 10,
            fontWeight: tab === "open" ? "bold" : "normal",
          }}
        >
          Open Bets
        </button>
        <button
          onClick={() => setTab("history")}
          style={{
            fontWeight: tab === "history" ? "bold" : "normal",
          }}
        >
          Bet History
        </button>
      </div>

      {status && <p><strong>Status:</strong> {status}</p>}

      {tab === "open" ? (
        openBets.length === 0 ? (
          <p>No currently paired matches.</p>
        ) : (
          openBets.map((b, index) => (
            <div
              key={`${b.matchId}-${index}`}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                marginBottom: 12,
                borderRadius: 8,
              }}
            >
              <p><strong>Match ID:</strong> {b.matchId}</p>
              <p><strong>Game:</strong> {b.gameType}</p>
              <p><strong>Stake:</strong> {formatEther(b.stake)} ETH</p>
              <p><strong>Players:</strong> {b.proposer} <br />vs<br /> {b.opponent}</p>
              <p><strong>Role:</strong> {b.isOpponent ? "Opponent" : "Proposer"}</p>
              <p><strong>💡 Tip:</strong> Use this Match ID when uploading your result on the Declare page.</p>
            </div>
          ))
        )
      ) : history.length === 0 ? (
        <p>No past bets.</p>
      ) : (
        history.map((m, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
            }}
          >
            <p><strong>{m.gameType}</strong> — {formatEther(m.stake)} ETH</p>
            <p>Players: {m.player1} vs {m.player2}<br />Winner: {m.winner}</p>
          </div>
        ))
      )}
    </div>
  );
}
