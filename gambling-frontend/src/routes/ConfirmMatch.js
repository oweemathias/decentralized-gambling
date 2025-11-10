// ✅ ConfirmMatch.js — Final version with auto-refresh every 10 seconds
import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "./WalletContext";
import { formatEther } from "ethers";
import { getPendingProposals } from "../helpers/getPendingProposals";

export default function ConfirmMatch() {
  const { contract, currentAccount } = useContext(WalletContext);
  const [pendingMatches, setPendingMatches] = useState([]);
  const [status, setStatus] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

  const loadMatches = async () => {
    if (!contract || !currentAccount) {
      setStatus("⚠ Connect wallet & contract first");
      return;
    }

    try {
      const raw = await getPendingProposals(contract, currentAccount);
      const viewer = currentAccount.toLowerCase();

      const normalized = (raw || []).map((m, i) => {
        const proposer = (m.proposer || "").toLowerCase();

        return {
          key: `${m.matchProposalIndex ?? i}-${proposer}`,
          matchProposalIndex: m.matchProposalIndex ?? i,
          proposer,
          gameType: m.gameType,
          stake: m.stake,
          hasPendingPairing: m.hasPendingPairing === true,
          isConfirmed: Boolean(m.isConfirmed),
          awaitingResponse: m.awaitingResponse === true,
          waitingForOpponent: m.waitingForOpponent === true,
          isViewerProposer: proposer === viewer,
          isOpponent: m.isOpponent === true,
          challenger: m.challenger,
        };
      });

      // compute visibleMatches using the same rules the UI will use
      const visibleMatches = normalized.filter((m) => {
        const shouldShow =
          !m.isConfirmed &&
          (!m.hasPendingPairing || m.waitingForOpponent || m.awaitingResponse) &&
          (!m.challenger || m.challenger === ZERO_ADDR);
        return shouldShow;
      });

      console.log("✅ Normalized proposals:", normalized);
      console.log("✅ Visible proposals (for UI):", visibleMatches);

      setPendingMatches(normalized);
      setStatus(`✅ ${visibleMatches.length} open proposal(s)`);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Fetch error:", e);
      setStatus("❌ Failed to load proposals");
    }
  };

  // 🔁 Auto-refresh every 10 seconds
  useEffect(() => {
    if (!contract || !currentAccount) return;

    loadMatches(); // initial load

    const interval = setInterval(() => {
      console.log("🔄 Auto-refreshing proposals...");
      loadMatches();
    }, 10000);

    return () => clearInterval(interval);
  }, [contract, currentAccount]);

  const handleRequestPairing = async (m) => {
    setStatus("⏳ Sending pairing request…");
    try {
      const tx = await contract.requestPairing(m.proposer, m.gameType, {
        value: m.stake,
      });
      await tx.wait();
      await loadMatches();
      setStatus("✅ Request sent — waiting on opponent!");
    } catch (e) {
      console.error(e);
      setStatus("❌ Request failed");
    }
  };

  const handleAccept = async (m) => {
    try {
      const tx = await contract.acceptPairing(m.matchProposalIndex);
      await tx.wait();
      await loadMatches();
      setStatus("✅ Match accepted!");
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed to accept match");
    }
  };

  const handleDecline = async (m) => {
    try {
      const tx = await contract.declinePairing(m.matchProposalIndex);
      await tx.wait();
      await loadMatches();
      setStatus("✅ Declined");
    } catch (e) {
      console.error(e);
      setStatus("❌ Decline failed");
    }
  };

  const handleCancel = async (m) => {
    try {
      const tx = await contract.cancelProposal(m.matchProposalIndex);
      await tx.wait();
      await loadMatches();
      setStatus("✅ Proposal cancelled");
    } catch (e) {
      console.error(e);
      setStatus("❌ Cancel failed");
    }
  };

  // 🧠 Belt-and-suspenders UI guard: compute visibleMatches from state
  const visibleMatches = pendingMatches.filter((m) => {
    const shouldShow =
      !m.isConfirmed &&
      (!m.hasPendingPairing || m.waitingForOpponent || m.awaitingResponse) &&
      (!m.challenger || m.challenger === ZERO_ADDR);

    if (!shouldShow) console.log("🚫 Hiding proposal (UI guard):", m);
    return shouldShow;
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>🎮 Confirm Match</h2>

      <div style={{ marginBottom: 15 }}>
        <button onClick={loadMatches} style={{ marginRight: 10 }}>
          🔄 Manual Refresh
        </button>
        {lastUpdated && (
          <span style={{ fontSize: "0.9em", color: "#555" }}>
            Last updated: {lastUpdated}
          </span>
        )}
      </div>

      {status && (
        <p>
          <strong>Status:</strong> {status}
        </p>
      )}

      {visibleMatches.length === 0 ? (
        <p>No open proposals.</p>
      ) : (
        visibleMatches.map((m) => {
          const safeKey = `${m.matchProposalIndex}-${m.proposer}`;

          if (m.waitingForOpponent) {
            return (
              <div key={safeKey} style={styles.card}>
                <p>⌛ Waiting for opponent to accept…</p>
                <InfoDisplay m={m} />
              </div>
            );
          }

          if (m.awaitingResponse && m.isOpponent) {
            return (
              <div key={safeKey} style={styles.card}>
                <button
                  onClick={() => handleAccept(m)}
                  style={{ marginRight: 10 }}
                >
                  ✅ Accept
                </button>
                <button onClick={() => handleDecline(m)} style={styles.decline}>
                  ❌ Decline
                </button>
                <InfoDisplay m={m} />
              </div>
            );
          }

          return (
            <div key={safeKey} style={styles.card}>
              {!m.isViewerProposer && (
                <button
                  onClick={() => handleRequestPairing(m)}
                  style={{ marginRight: 10 }}
                >
                  🤝 Match
                </button>
              )}
              {m.isViewerProposer && (
                <button onClick={() => handleCancel(m)} style={styles.cancel}>
                  🚫 Cancel
                </button>
              )}
              <InfoDisplay m={m} />
            </div>
          );
        })
      )}
    </div>
  );
}

const InfoDisplay = ({ m }) => (
  <div style={{ marginTop: 8 }}>
    <strong>Proposer:</strong> {m.proposer} <br />
    <strong>Game:</strong> {m.gameType} <br />
    <strong>Stake:</strong> {formatEther(m.stake || 0)} ETH
  </div>
);

const styles = {
  card: {
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  decline: {
    background: "red",
    color: "white",
    marginRight: 10,
  },
  cancel: {
    background: "orange",
    color: "white",
  },
};
