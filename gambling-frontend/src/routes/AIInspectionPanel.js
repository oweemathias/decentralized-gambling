// src/routes/AIInspectionPanel.js
import React, { useEffect, useState } from "react";

/**
 * AIInspectionPanel (improved)
 * - Fetches POST /api/ai-evaluate
 * - Logs full response to console
 * - Accepts several response shapes (data.aiResults, data.results, raw array)
 * - If no aiResults found, shows the raw JSON so you can see what's returned
 */

export default function AIInspectionPanel() {
  const [aiResults, setAiResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAiResults = async () => {
    setLoading(true);
    setError(null);
    setAiResults(null);

    try {
      const res = await fetch("http://localhost:3098/api/ai-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // we send an empty body — server ignores or may accept filters
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => null);
      console.log("🛰 /api/ai-evaluate response (raw):", res, data);

      if (!res.ok) {
        setError(`Server responded ${res.status}`);
        setAiResults(data ?? null);
        setLoading(false);
        return;
      }

      // Defensive extraction: support multiple possible shapes
      // 1) { aiResults: [...] }
      // 2) { aiResults: { ... } } (single)
      // 3) raw array [...]
      // 4) { results: [...] }
      let list = null;

      if (data == null) {
        list = [];
      } else if (Array.isArray(data.aiResults)) {
        list = data.aiResults;
      } else if (Array.isArray(data.results)) {
        list = data.results;
      } else if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.aiResults?.aiResults)) {
        // defensive double-wrap
        list = data.aiResults.aiResults;
      } else {
        // no array found — show object as single-item list if it looks like a result
        // heuristic: has matchId or playerAddress or file
        if (data.matchId || data.playerAddress || data.file) {
          list = [data];
        } else {
          list = [];
        }
      }

      setAiResults(list);
    } catch (err) {
      console.error("Fetch AI results failed:", err);
      setError(err.message || String(err));
      setAiResults(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openImage = (filename) => {
    if (!filename) return;
    const url = `http://localhost:3098/uploads/${filename}`;
    window.open(url, "_blank");
  };

  const callDeclareWinner = async (playerAddress, matchId, idx) => {
    if (!playerAddress || playerAddress === "unknown") {
      alert("No valid player address available to declare.");
      return;
    }

    if (!window.confirm(`Declare ${playerAddress} as winner for match ${matchId}?`)) return;

    try {
      const res = await fetch("http://localhost:3098/api/game-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: playerAddress, matchId }),
      });
      const data = await res.json();
      console.log("declareWinner response:", res.status, data);
      if (res.ok) {
        alert("✅ Declared. Check server logs or tx hash if provided.");
        // refresh AI results after declare
        fetchAiResults();
      } else {
        alert("❌ Failed to declare: " + (data?.error || JSON.stringify(data)));
      }
    } catch (err) {
      console.error("Error declaring winner:", err);
      alert("❌ Error declaring winner: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-2xl">
      <h2 className="text-2xl font-semibold text-center mb-2">🔎 AI Inspection Panel</h2>
      <p className="text-center text-gray-500 mb-4">Review simulated AI predictions and optionally declare winners.</p>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={fetchAiResults}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          🔄 Refresh AI Results
        </button>
      </div>

      {loading && <div className="text-center py-8">Loading AI results…</div>}

      {error && <div className="text-red-600 mb-4">Error: {error}</div>}

      {!loading && aiResults && aiResults.length === 0 && (
        <div className="p-4 bg-yellow-50 rounded">
          <p>No AI results array was returned by the server.</p>
          <p className="text-sm text-gray-600 mt-2">
            Please check server console for logs. You can also run the endpoint manually (see instructions below).
          </p>
        </div>
      )}

      {!loading && aiResults && aiResults.length > 0 && (
        <div className="space-y-4">
          {aiResults.map((r, idx) => {
            const conf = Number(r.confidence) || 0;
            return (
              <div key={`${r.matchId ?? "m"}-${idx}`} className="border rounded-xl p-4 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Match</div>
                    <div className="text-lg font-medium">{r.matchId ?? "unknown"}</div>
                    <div className="mt-1 text-sm">
                      <strong>Player (predicted):</strong> {r.playerAddress ?? r.player ?? "unknown"}
                    </div>
                    <div className="mt-1 text-sm">
                      <strong>Confidence:</strong> {(conf * 100).toFixed(2) || "N/A"}%
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      <strong>Result:</strong> {r.result ?? "unknown"}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {r.file && (
                      <button onClick={() => openImage(r.file)} className="text-sm px-3 py-1 border rounded hover:bg-white">
                        🖼 Open Image
                      </button>
                    )}

                    <button
                      onClick={() => callDeclareWinner(r.playerAddress ?? r.player, r.matchId, idx)}
                      className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
                    >
                      ⚙ Use AI Result
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Debug: show raw JSON of aiResults for quick inspection */}
      {!loading && (
        <div className="mt-6 p-3 bg-gray-100 rounded">
          <strong>Debug (raw AI payload):</strong>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
            {JSON.stringify(aiResults ?? "No data returned", null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
