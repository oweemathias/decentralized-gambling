// src/routes/OraclePanel.js
import React, { useEffect, useState } from "react";

// ✅ Convert the AI prediction logic into a helper (not a hook)
async function getAiPredictionForFile(file) {
  try {
    const res = await fetch("http://localhost:3098/api/ai-evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: file.matchId,
        filePath: file.path,
        playerAddress: file.playerAddress,
      }),
    });
    const data = await res.json();
    return data; // e.g. { winner: "...", confidence: 0.92 }
  } catch (err) {
    console.error("AI prediction failed:", err);
    return { winner: null, confidence: 0 };
  }
}

export default function OraclePanel() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  // Fetch uploaded results
  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch("http://localhost:3098/api/uploads");
        const data = await res.json();
        setResults(data.files || []);
      } catch (err) {
        console.error("Error fetching uploaded files:", err);
      }
    }
    fetchResults();
  }, []);

  // ✅ Declare winner API call
  async function declareWinner(playerAddress, matchId) {
    if (!window.confirm(`Declare ${playerAddress} as winner for match ${matchId}?`)) {
      return;
    }

    let winnerAddress = playerAddress.trim();
    if (!winnerAddress.startsWith("0x")) winnerAddress = "0x" + winnerAddress;
    if (winnerAddress.length !== 42) {
      alert(`⚠️ Invalid winner address:\n${winnerAddress}`);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("http://localhost:3098/api/game-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: winnerAddress, matchId }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`✅ Winner declared!\nTx: ${data.txHash || "N/A"}`);
      } else {
        alert(`❌ Error: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error declaring winner:", error);
      alert("❌ Failed to declare winner. Check console.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ AI Automation simulation button
  async function handleAiAutomation() {
    setAiStatus("Analyzing uploaded files with AI...");

    for (const file of results) {
      const aiResult = await getAiPredictionForFile(file);
      console.log("AI Result for", file.matchId, aiResult);
    }

    setAiStatus("✅ AI analysis complete. Check AI Inspection Panel for results.");
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-2xl">
      <h2 className="text-2xl font-semibold text-center mb-2">
        🧠 Oracle Control Panel
      </h2>
      <p className="text-center text-gray-500 mb-6">
        Review uploaded results and declare winners.
      </p>

      {/* AI Automation Button */}
      <div className="text-center mb-6">
        <button
          onClick={handleAiAutomation}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          🤖 Run AI Automation
        </button>
        {aiStatus && <p className="text-sm text-gray-600 mt-2">{aiStatus}</p>}
      </div>

      {loading && (
        <div className="text-center text-blue-600 font-medium mb-4">
          Processing... please wait.
        </div>
      )}

      {results.length === 0 ? (
        <p className="text-center text-gray-500">No uploaded results found.</p>
      ) : (
        results.map((file, index) => (
          <div
            key={index}
            className="border rounded-xl p-4 mb-4 bg-gray-50 shadow-sm"
          >
            <h3 className="font-semibold mb-2">
              🎮 Match ID: {file.matchId || "Unknown"} ({file.gameType || "N/A"})
            </h3>
            <p className="text-gray-600 mb-2">
              Player: {file.playerAddress || "Unknown"}
            </p>
            <img
              src={`http://localhost:3098/${file.path}`}
              alt="Result Upload"
              className="w-full rounded-lg border mb-3"
            />
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              onClick={() => declareWinner(file.playerAddress, file.matchId)}
            >
              Declare Winner (This Player)
            </button>
          </div>
        ))
      )}
    </div>
  );
}
