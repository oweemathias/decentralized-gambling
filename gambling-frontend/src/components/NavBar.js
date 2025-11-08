// src/components/NavBar.js
import React from "react";
import { Link } from "react-router-dom";

const NavBar = () => {
  return (
    <nav style={{ marginBottom: 20 }}>
      <Link to="/"        style={{ marginRight: 10 }}>Home</Link>
      <Link to="/deposit" style={{ marginRight: 10 }}>Deposit</Link>
      <Link to="/withdraw" style={{ marginRight: 10 }}>Withdraw</Link>
      <Link to="/propose" style={{ marginRight: 10 }}>Propose</Link>
      <Link to="/confirm" style={{ marginRight: 10 }}>Confirm</Link>
      <Link to="/open-bets" style={{ marginRight: 10 }}>Open Bets</Link>  {/* ← New */}
      <Link to="/declare" style={{ marginRight: 10 }}>Declare</Link>
      <Link to="/history">History</Link>
    </nav>
  );
};

export default NavBar;
