// src/routes/Transactions.js
import React, { useContext, useEffect, useRef, useState } from "react";
import { WalletContext } from "./WalletContext";
import { formatEther } from "ethers";

export default function Transactions() {
  const { contract, currentAccount, provider } = useContext(WalletContext);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  // cache blockNumber -> formatted time
  const blockTimeCache = useRef({});

  useEffect(() => {
    if (!contract || !currentAccount) {
      setTxs([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      try {
        const activeProvider = provider;

        /* =========================
           1️⃣ QUERY EVENTS
        ========================= */

        const [
          fundedEvents,
          withdrawnEvents,
          stakeJoinedEvents,
          winEvents,
          lossEvents,
        ] = await Promise.all([
          contract.queryFilter(
            contract.filters.PlayerFunded(currentAccount),
            0,
            "latest"
          ),
          contract.queryFilter(
            contract.filters.PlayerWithdrawn(currentAccount),
            0,
            "latest"
          ),
          contract
            .queryFilter(
              contract.filters.StakeJoined(null, currentAccount),
              0,
              "latest"
            )
            .catch(() => []),
          contract
            .queryFilter(
              contract.filters.WinnerDeclared(null, currentAccount),
              0,
              "latest"
            )
            .catch(() => []),
          contract
            .queryFilter(
              contract.filters.MatchLost(null, currentAccount),
              0,
              "latest"
            )
            .catch(() => []),
        ]);

        // ProposalCreated → proposer NOT indexed → client-side filter
        const proposalEventsAll = await contract.queryFilter(
          contract.filters.ProposalCreated(),
          0,
          "latest"
        );

        const proposalEvents = proposalEventsAll.filter(
          (e) =>
            e.args?.proposer?.toLowerCase() ===
            currentAccount.toLowerCase()
        );

        /* =========================
           2️⃣ NORMALIZE (NO TIME YET)
        ========================= */

        const normalized = [
          ...fundedEvents.map((e) => ({
            type: "💰 Deposit",
            amount: formatEther(e.args.amount),
            txHash: e.transactionHash,
            block: e.blockNumber.toString(),
          })),

          ...withdrawnEvents.map((e) => ({
            type: "🏧 Withdraw",
            amount: formatEther(e.args.amount),
            txHash: e.transactionHash,
            block: e.blockNumber.toString(),
          })),

          ...stakeJoinedEvents.map((e) => ({
            type: "🤝 Stake Joined",
            amount: formatEther(e.args.amount),
            txHash: e.transactionHash,
            block: e.blockNumber.toString(),
          })),

          ...proposalEvents.map((e) => ({
            type: "🎯 Match Proposed",
            amount: formatEther(e.args.stake),
            gameType: e.args.gameType,
            txHash: e.transactionHash,
            block: e.blockNumber.toString(),
          })),

          ...winEvents.map((e) => ({
            type: "🏆 Won Bet",
            amount: formatEther(e.args.payout),
            txHash: e.transactionHash,
            block: e.blockNumber.toString(),
          })),

          ...lossEvents.map((e) => ({
            type: "❌ Lost Bet",
            amount: formatEther(e.args.amountLost),
            txHash: e.transactionHash,
            block: e.blockNumber.toString(),
          })),
        ];

        /* =========================
           3️⃣ FETCH BLOCK TIMES (ONCE)
        ========================= */

        if (provider) {
          const uniqueBlocks = [
            ...new Set(normalized.map((tx) => tx.block)),
          ].filter((b) => !blockTimeCache.current[b]);

          const blocks = await Promise.all(
            uniqueBlocks.map((b) => provider.getBlock(Number(b)))
          );

          blocks.forEach((blk) => {
            blockTimeCache.current[blk.number.toString()] =
              new Date(blk.timestamp * 1000).toLocaleString();
          });
        }

        const withTimes = normalized.map((tx) => ({
          ...tx,
          time:
            blockTimeCache.current[tx.block] ||
            `Block ${tx.block}`,
        }));

        /* =========================
           4️⃣ SORT & SET
        ========================= */

        withTimes.sort(
          (a, b) => Number(b.block) - Number(a.block)
        );

        setTxs(withTimes);
      } catch (err) {
        console.error("Transactions load error:", err);
        setTxs([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [contract, currentAccount]);

  return (
    <div style={{ padding: 20 }}>
      <h2>🔄 Transactions</h2>

      {loading ? (
        <p>Loading transactions...</p>
      ) : txs.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        txs.map((tx, i) => (
          <div
            key={i}
            style={{
              background: "#111",
              color: "#fff",
              padding: 12,
              borderRadius: 6,
              marginBottom: 10,
            }}
          >
            <strong>{tx.type}</strong>

            <div style={{ marginTop: 6 }}>
              {tx.amount} ETH{" "}
              {tx.gameType ? `— ${tx.gameType}` : ""}
            </div>

            <div style={{ marginTop: 6 }}>
              <small>{tx.time}</small>
            </div>

            <div style={{ marginTop: 6 }}>
              <small>
                {tx.txHash.slice(0, 10)}…
                {tx.txHash.slice(-6)}
              </small>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
