import React, { useState } from "react";
import { BrowserProvider, Contract, parseEther } from "ethers";
import contractABI from "../Gambling.json";

const Withdraw = () => {
  const [amount, setAmount] = useState("");

  const handleWithdraw = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      // Connect to provider & signer
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Your deployed contract address
      const contractAddress = "0x99361bB350D3ac9d3562856ec938dd6072ea46Ef"; // 🔴 replace with actual address
      const contract = new Contract(contractAddress, contractABI, signer);

      // Convert entered ETH to wei
      const weiAmount = parseEther(amount);

      // Call withdrawBalance with the amount
      const tx = await contract.withdrawBalance(weiAmount);
      await tx.wait();

      alert(`✅ Successfully withdrew ${amount} ETH`);
    } catch (error) {
      console.error("Withdraw error:", error);
      alert("❌ Withdrawal failed – check console for details");
    }
  };

  return (
    <div>
      <h2>Withdraw Funds</h2>
      <input
        type="text"
        placeholder="Enter amount (ETH)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={handleWithdraw}>Withdraw</button>
    </div>
  );
};

export default Withdraw;
