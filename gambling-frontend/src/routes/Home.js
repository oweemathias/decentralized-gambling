// src/routes/Home.js
import React, { useContext } from "react";
import { WalletContext } from "./WalletContext";

const Home = () => {
  const { address, balance, connectWallet } = useContext(WalletContext);

  return (
    <div>
      <h1>🎰 Welcome to the Gambling DApp</h1>
      {address ? (
        <div>
          <p><strong>Connected:</strong> {address}</p>
          <p><strong>ETH Balance:</strong> {balance} ETH</p>
        </div>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}
    </div>
  );
};

export default Home;
