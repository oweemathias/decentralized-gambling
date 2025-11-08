// ✅ ConfirmMatch.js — Updated with final safety guard
import React, { useContext, useEffect, useState } from "react";
import { WalletContext } from "./WalletContext";
import { formatEther } from "ethers";
import { getPendingProposals } from "../helpers/getPendingProposals";

export default function ConfirmMatch() {
  const { contract, currentAccount } = useContext(WalletContext);
  const [pendingMatches, setPendingMatches] = useState([]);
  const [status, setStatus] = useState("");

  const loadMatches = async () => {
    if (!contract || !currentAccount) {
      setStatus("⚠ Connect wallet & contract first");
      return;
    }

    try {
      const raw = await getPendingProposals(contract, currentAccount);
      console.log("Raw proposals:", raw);

      const viewer = currentAccount.toLowerCase();

      const normalized = (raw || []).map((m, i) => {
        const proposer = m.proposer.toLowerCase();

        const isViewerProposer = proposer === viewer;
        const isOpponent = m.isOpponent === true;
        const awaitingResponse = m.awaitingResponse === true;
        const hasPendingPairing = m.hasPendingPairing === true;
        const waitingForOpponent = m.waitingForOpponent === true;

        return {
          key: `${m.matchProposalIndex ?? i}-${proposer}`,
          matchProposalIndex: m.matchProposalIndex ?? i,
          proposer,
          gameType: m.gameType,
          stake: m.stake,
          hasPendingPairing,
          isConfirmed: Boolean(m.isConfirmed),
          awaitingResponse,
          waitingForOpponent,
          isViewerProposer,
          isOpponent,
          challenger: m.challenger,
        };
      });

      console.log("✅ Normalized proposals:", normalized);
      setPendingMatches(normalized);
      setStatus(`✅ ${normalized.length} open proposal(s)`);
    } catch (e) {
      console.error("Fetch error:", e);
      setStatus("❌ Failed to load proposals");
    }
  };

  useEffect(() => {
    if (contract && currentAccount) loadMatches();
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

  // 🧠 Belt-and-suspenders: UI guard — never show confirmed matches or paired ones
  const visibleMatches = pendingMatches.filter(
    (m) =>
      !m.isConfirmed &&
      !m.hasPendingPairing &&
      (!m.challenger || m.challenger === "0x0000000000000000000000000000000000000000")
  );

  return (
    <div style={{ padding: 20 }}>
      <h2>🎮 Confirm Match</h2>
      <button onClick={loadMatches} style={{ marginBottom: 15 }}>
        🔄 Refresh
      </button>
      {status && (
        <p>
          <strong>Status:</strong> {status}
        </p>
      )}

      {visibleMatches.length === 0 ? (
        <p>No open proposals.</p>
      ) : (
        visibleMatches.map((m, i) => {
          const safeKey = `${m.matchProposalIndex}-${m.proposer}`;

          console.log("🔍 Proposal flags (frontend render):", {
            viewer: currentAccount,
            proposer: m.proposer,
            isViewerProposer: m.isViewerProposer,
            isOpponent: m.isOpponent,
            awaitingResponse: m.awaitingResponse,
            waitingForOpponent: m.waitingForOpponent,
            hasPendingPairing: m.hasPendingPairing,
            challenger: m.challenger,
          });

          if (m.waitingForOpponent) {
            return (
              <div key={safeKey} style={styles.card}>
                <p>⌛ Waiting for opponent to accept…</p>
                <InfoDisplay m={m} />
              </div>
            );
          }

          if (m.awaitingResponse && m.isOpponent && m.hasPendingPairing) {
            console.log("✅ Showing ACCEPT/DECLINE for:", m.proposer);
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
