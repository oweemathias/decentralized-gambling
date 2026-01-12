// src/routes/WalletContext.js
import React, { createContext, useState, useEffect } from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import gamblingABI from "../Gambling.json";

export const WalletContext = createContext();

const CONTRACT_ADDRESS = "0x568b8F193099EE2528ce92444fB14C5619E0E2E4";

export const WalletProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer,   setSigner]   = useState(null);
  const [address,  setAddress]  = useState(null);
  const [balance,  setBalance]  = useState(null);
  const [contract, setContract] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask not detected.");
      return;
    }
    try {
      const newProvider = new BrowserProvider(window.ethereum);
      const newSigner   = await newProvider.getSigner();
      const userAddress = await newSigner.getAddress();
      const userBal     = await newProvider.getBalance(userAddress);

      setProvider(newProvider);
      setSigner(newSigner);
      setAddress(userAddress);
      setBalance( formatEther(userBal) );
      setContract( new Contract(CONTRACT_ADDRESS, gamblingABI, newSigner) );
    } catch (err) {
      console.error("Wallet connection error:", err);
    }
  };

  const refreshBalance = async () => {
    if (provider && address) {
      const updated = await provider.getBalance(address);
      setBalance(formatEther(updated));
    }
  };

  // auto‐connect on start
  useEffect(() => {
    connectWallet();
  }, []);

  return (
    <WalletContext.Provider value={{
      provider,
      signer,
      contract,
      // renamed alias to match what your ConfirmMatch expects:
      currentAccount: address,
      balance,
      connectWallet,
      refreshBalance,
    }}>
      {children}
    </WalletContext.Provider>
  );
};
