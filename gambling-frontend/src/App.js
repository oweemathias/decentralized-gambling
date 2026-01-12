// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./routes/WalletContext";

import Home from "./routes/Home";
import Deposit from "./routes/Deposit";
import Withdraw from "./routes/Withdraw";
import ProposeMatch from "./routes/ProposeMatch";
import ConfirmMatch from "./routes/ConfirmMatch";
import OpenBets from "./routes/OpenBets";        // ← New!
import DeclareWinner from "./routes/DeclareWinner";
import OraclePanel from "./routes/OraclePanel";
import AIInspectionPanel from "./routes/AIInspectionPanel";
import MatchHistory from "./routes/MatchHistory";
import SetOracle from "./routes/SetOracle";     // ← New!
import Transactions from "./routes/Transactions";
import Gifts from "./routes/Gifts";

import NavBar from "./components/NavBar";
import ProfileIcon from "./components/ProfileIcon"; // ✅ ADD THIS

function App() {
  return (
    <WalletProvider>
      <Router>
        {/* Profile icon floats above everything */}
        <ProfileIcon /> {/* ✅ ADD THIS */}

        <div style={{ padding: 20 }}>
          <h1>🎰 Decentralized Gambling DApp</h1>
          <NavBar />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/deposit" element={<Deposit />} />
            <Route path="/withdraw" element={<Withdraw />} />
            <Route path="/propose" element={<ProposeMatch />} />
            <Route path="/confirm" element={<ConfirmMatch />} />
            <Route path="/open-bets" element={<OpenBets />} />   {/* ← New route */}
            <Route path="/declare" element={<DeclareWinner />} />
            <Route path="/oracle" element={<OraclePanel />} />
            <Route path="/ai-inspection" element={<AIInspectionPanel />} />
            <Route path="/history" element={<MatchHistory />} />
            <Route path="/set-oracle" element={<SetOracle />} /> {/* ← New route */}
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/gifts" element={<Gifts />} />
          </Routes>
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;
