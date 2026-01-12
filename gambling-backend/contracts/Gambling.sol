// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Gambling {
    using ECDSA for bytes32;

    address public owner;
    address public oracleSigner;
    uint256 public commissionPercentage = 5; // percent (e.g., 5 => 5%)

    struct MatchProposal {
        address proposer;
        address opponent;
        uint256 stake;
        string gameType;
        bool isConfirmed;
    }

    struct Match {
        address player1;
        address player2;
        uint256 stake;
        string gameType;
        address winner;
        bool isCompleted;
    }

    struct PairingRequest {
        uint256 matchProposalIndex;
        address proposer;
        address opponent;
        string gameType;
        bool isAccepted;
        bool isPending;
    }

    struct Rewards {
        uint256 cashback;
        uint256 daily;
        uint256 referral;
    }

    MatchProposal[] public pendingProposals;
    Match[]         public matchHistory;
    mapping(address => uint256) public balances;
    // Key by opponent address for correct request lookup
    mapping(address => PairingRequest) public pairingRequests;

    // NEW: track canceled and completed proposals by index (no change to existing struct ABI)
    mapping(uint256 => bool) public proposalCanceled;
    mapping(uint256 => bool) public proposalCompleted;

    mapping(address => Rewards) public rewards;
    mapping(address => uint256) public lastActiveDay;
    mapping(address => address) public referrer;


    event PlayerFunded(address indexed player, uint256 amount);
    event ProposalCreated(uint256 indexed index, address proposer, uint256 stake, string gameType);
    event PairingRequested(uint256 indexed proposalIndex, address indexed proposer, address indexed opponent);
    event PairingAccepted(uint256 indexed proposalIndex, address indexed opponent);
    event PairingAcceptedDetailed(uint256 indexed proposalIndex, address indexed proposer, address indexed challenger);
    event PairingDeclined(uint256 indexed proposalIndex, address indexed opponent);
    event ProposalCanceled(uint256 indexed proposalIndex, address indexed proposer);
    event WinnerDeclared(uint256 indexed proposalIndex, address indexed winner, uint256 payout, uint256 commission);
    event OracleSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event StakeJoined(uint256 indexed proposalIndex, address indexed opponent, uint256 amount);
    event MatchLost(uint256 indexed proposalIndex, address indexed loser, uint256 amountLost);
    event PlayerWithdrawn(address indexed player, uint256 amount);
    event RewardGranted(address indexed user, uint256 amount, string kind);
    event RewardsClaimed(address indexed user, uint256 amount);
    event ReferrerSet(address indexed user, address indexed referrer);

    constructor() {
        owner        = msg.sender;
        oracleSigner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can perform this action");
        _;
    }

    // ========== FUND PLAYER ==========
    function fundPlayer() external payable {
        require(msg.value > 0, "Must send some ETH to fund balance.");
        balances[msg.sender] += msg.value;
        emit PlayerFunded(msg.sender, msg.value);
    }

    // ========== PROPOSE MATCH ==========
    function proposeMatch(uint256 stake, string memory gameType) external {
        require(balances[msg.sender] >= stake, "Insufficient balance to propose match.");
        // Reserve stake from proposer's balance (keeps ETH in contract)
        balances[msg.sender] -= stake;

        pendingProposals.push(MatchProposal({
            proposer    : msg.sender,
            opponent    : address(0),
            stake       : stake,
            gameType    : gameType,
            isConfirmed : false
        }));

        emit ProposalCreated(pendingProposals.length - 1, msg.sender, stake, gameType);

        // referral: if proposer has a referrer, give the referrer a referral bonus
        address ref = referrer[msg.sender];
        if (ref != address(0)) {
            uint256 referralBonus = (stake * 2) / 100; // 2%
            rewards[ref].referral += referralBonus;

            emit RewardGranted(ref, referralBonus, "referral");
    }
}
    // ========== PAIRING LOGIC ==========
   function requestPairing(address proposer, string memory gameType) external payable {
    // find the matching open proposal
    for (uint i = 0; i < pendingProposals.length; i++) {
        MatchProposal storage p = pendingProposals[i];
        if (
            p.proposer == proposer &&
            keccak256(bytes(p.gameType)) == keccak256(bytes(gameType)) &&
            !p.isConfirmed &&
            p.opponent == address(0) &&
            !proposalCanceled[i] &&
            !proposalCompleted[i]
        ) {
            require(msg.value == p.stake, "Stake mismatch"); // ✅ opponent sends ETH here

            // ✅ Record pairing request under the challenger (msg.sender)
            pairingRequests[msg.sender] = PairingRequest({
                matchProposalIndex: i,
                proposer: proposer,
                opponent: proposer,
                gameType: gameType,
                isAccepted: false,
                isPending: true
            });

            // ✅ Record the same pairing under the proposer
            // so the proposer can also see the pending request
            pairingRequests[proposer] = PairingRequest({
                matchProposalIndex: i,
                proposer: proposer,
                opponent: msg.sender,
                gameType: gameType,
                isAccepted: false,
                isPending: true
            });

            emit PairingRequested(i, proposer, msg.sender);
            emit StakeJoined(i, msg.sender, msg.value);
            return;
        }
    }

    revert("No available proposal to pair with.");
}

    function acceptPairing(uint256 matchProposalIndex) external {
        require(matchProposalIndex < pendingProposals.length, "Invalid index");
        MatchProposal storage p = pendingProposals[matchProposalIndex];
        require(!proposalCanceled[matchProposalIndex], "Proposal canceled.");
        require(!proposalCompleted[matchProposalIndex], "Proposal completed.");
        require(!p.isConfirmed, "Already confirmed.");
        require(p.opponent == address(0), "Already paired.");

        // Only opponent (not proposer) can accept
        require(msg.sender != p.proposer, "Proposer cannot accept own match");

        // finalize pairing
        p.opponent = msg.sender;
        p.isConfirmed = true;

        // Cancel caller's own open proposal (if any)
        for (uint256 i = 0; i < pendingProposals.length; i++) {
            if (
                pendingProposals[i].proposer == msg.sender &&
                !pendingProposals[i].isConfirmed &&
                !proposalCanceled[i] &&
                keccak256(bytes(pendingProposals[i].gameType)) == keccak256(bytes(p.gameType)) &&
                pendingProposals[i].stake == p.stake
            ) {
                proposalCanceled[i] = true;
                break;
            }
        }

        // Clear pairingRequests for both challenger and proposer to avoid stale UI state
        delete pairingRequests[msg.sender];     // challenger
        delete pairingRequests[p.proposer];     // proposer

        // Emit both: keep old event for backward compatibility; detailed event for new consumers
        emit PairingAccepted(matchProposalIndex, msg.sender);
        emit PairingAcceptedDetailed(matchProposalIndex, p.proposer, msg.sender);
        
        // daily reward to proposer
        uint256 today = _today();
        if (lastActiveDay[msg.sender] < today) {
            uint256 dailyReward = 0.002 ether; // example
            rewards[msg.sender].daily += dailyReward;
            lastActiveDay[msg.sender] = today;

            emit RewardGranted(msg.sender, dailyReward, "daily");
    }
}
    function declinePairing(uint256 matchProposalIndex) external {
        PairingRequest storage req = pairingRequests[msg.sender];

        if (req.isPending && req.matchProposalIndex == matchProposalIndex) {
            delete pairingRequests[msg.sender];
            emit PairingDeclined(matchProposalIndex, msg.sender);
            return;
        }

        MatchProposal storage p = pendingProposals[matchProposalIndex];
        if (msg.sender == p.proposer && pairingRequests[p.proposer].isPending) {
            delete pairingRequests[p.proposer];
            emit PairingDeclined(matchProposalIndex, msg.sender);
            return;
        }

        revert("No valid pairing to decline.");
    }

    // Allow proposer to cancel an unconfirmed proposal and get stake back
    function cancelProposal(uint256 matchProposalIndex) external {
        require(matchProposalIndex < pendingProposals.length, "Invalid index.");
        MatchProposal storage p = pendingProposals[matchProposalIndex];
        require(p.proposer == msg.sender, "Only proposer can cancel");
        require(!p.isConfirmed, "Cannot cancel a confirmed proposal");
        require(!proposalCanceled[matchProposalIndex], "Already canceled");
        require(!proposalCompleted[matchProposalIndex], "Already completed");

        // Mark canceled, return stake to proposer's balance
        proposalCanceled[matchProposalIndex] = true;
        balances[msg.sender] += p.stake;

        emit ProposalCanceled(matchProposalIndex, msg.sender);
    }

    // ========== GET ALL PENDING PROPOSALS (raw) ==========
    function getAllPendingProposals() external view returns (MatchProposal[] memory) {
        return pendingProposals;
    }

    // ========== GET PENDING PROPOSALS FOR FRONTEND ==========
 function getPendingProposalsFor(address viewer)
    external
    view
    returns (
        uint256[] memory indexes,
        address[] memory proposers,
        uint256[] memory stakes,
        string[] memory gameTypes,
        bool[] memory isConfirmeds,
        bool[] memory hasPendingPairings,
        bool[] memory isOpponents
    )
{
    uint256 len = pendingProposals.length;
    uint256 count = 0;

    // Count only unconfirmed proposals that have no opponent and not canceled
    for (uint256 i = 0; i < len; i++) {
        MatchProposal memory p = pendingProposals[i];
        if (!p.isConfirmed && p.opponent == address(0) && !proposalCanceled[i]) {
            count++;
        }
    }

    indexes = new uint256[](count);
    proposers = new address[](count);
    stakes = new uint256[](count);
    gameTypes = new string[](count);
    isConfirmeds = new bool[](count);
    hasPendingPairings = new bool[](count);
    isOpponents = new bool[](count);

    uint256 j = 0;
    for (uint256 i = 0; i < len; i++) {
        MatchProposal memory p = pendingProposals[i];
        if (p.isConfirmed || p.opponent != address(0) || proposalCanceled[i]) continue;

        indexes[j] = i;
        proposers[j] = p.proposer;
        stakes[j] = p.stake;
        gameTypes[j] = p.gameType;
        isConfirmeds[j] = p.isConfirmed;

        PairingRequest memory reqViewer = pairingRequests[viewer];
        PairingRequest memory reqProposer = pairingRequests[p.proposer];

        bool viewerSent = (
            reqViewer.isPending &&
            reqViewer.matchProposalIndex == i &&
            reqViewer.opponent == p.proposer
        );

        bool viewerReceived = (
            reqProposer.isPending &&
            reqProposer.matchProposalIndex == i &&
            reqProposer.opponent == viewer
        );

        hasPendingPairings[j] = viewerSent || viewerReceived;
        isOpponents[j] = viewerSent;

        j++;
    }
}

    // ========== NEW: GET CONFIRMED (PAIRED) PROPOSALS FOR FRONTEND ==========
    function getConfirmedProposalsFor(address viewer) external view returns (
        uint256[] memory indexes,
        address[] memory proposers,
        uint256[] memory stakes,
        string[] memory gameTypes,
        bool[] memory isConfirmeds,
        bool[] memory hasPendingPairings,
        bool[] memory isOpponents
    ) {
        uint256 len = pendingProposals.length;
        uint256 count = 0;

    // First pass: count how many confirmed matches involve this viewer
    for (uint256 i = 0; i < len; i++) {
        MatchProposal memory p = pendingProposals[i];
        if (
            p.isConfirmed &&
            (p.proposer == viewer || p.opponent == viewer)
        ) {
            count++;
        }
    }

    // Allocate arrays
        indexes = new uint256[](count);
        proposers = new address[](count);
        stakes = new uint256[](count);
        gameTypes = new string[](count);
        isConfirmeds = new bool[](count);
        hasPendingPairings = new bool[](count);
        isOpponents = new bool[](count);

        uint256 idx = 0;
     
     PairingRequest memory vr = pairingRequests[viewer]; // 
    // Second pass: populate the data
    for (uint256 i = 0; i < len; i++) {
        MatchProposal memory p = pendingProposals[i];
        if (
            p.isConfirmed &&
            (p.proposer == viewer || p.opponent == viewer)
        ) {
            indexes[idx] = i;
            proposers[idx] = p.proposer;
            stakes[idx] = p.stake;
            gameTypes[idx] = p.gameType;
            isConfirmeds[idx] = p.isConfirmed;
            hasPendingPairings[idx] = (
                vr.isPending &&
                vr.matchProposalIndex == i
            );
            isOpponents[idx] = (p.opponent == viewer);
            idx++;
        }
    }
}
  
    // ========== GET MATCH HISTORY (completed) ==========
    function getMatchHistory() external view returns (Match[] memory) {
        return matchHistory;
    }

    // ========== DECLARE WINNER (with oracle signature verification) ==========
    /**
     * Signature scheme (MUST be produced by the oracle server):
     *
     * hash = keccak256(abi.encodePacked(
     *   matchProposalIndex,            // uint256
     *   proposerAddress,               // address
     *   opponentAddress,               // address
     *   winnerAddress,                 // address
     *   stake,                         // uint256
     *   gameType,                      // string
     *   address(this)                  // contract address (prevents cross-contract replay)
     * ));
     *
     * ethSignedHash = ECDSA.toEthSignedMessageHash(hash);
     * signature = oracleWallet.signMessage(arrayify(hash)); // ethers.js: wallet.signMessage(arrayify(hash))
     *
     * On-chain we will reconstruct same hash and call recover(signature) and compare to oracleSigner.
     */
    function declareWinner(
        uint256 matchProposalIndex,
        address winner,
        bytes calldata signature
    ) external {
        require(matchProposalIndex < pendingProposals.length, "Invalid proposal index.");
        MatchProposal storage p = pendingProposals[matchProposalIndex];

        require(!proposalCanceled[matchProposalIndex], "Proposal canceled.");
        require(!proposalCompleted[matchProposalIndex], "Proposal already completed.");
        require(p.isConfirmed, "Match not confirmed.");
        require(p.opponent != address(0), "Match has no opponent.");
        require(winner == p.proposer || winner == p.opponent, "Winner not a participant.");

        // Recreate the signed message hash exactly as the oracle should have signed
        bytes32 messageHash = keccak256(abi.encodePacked(
            matchProposalIndex,
            p.proposer,
            p.opponent,
            winner,
            p.stake,
            p.gameType,
            address(this)
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == oracleSigner, "Invalid oracle signature");

        // Checks done — now update state before transferring funds (Checks-Effects-Interactions)
        proposalCompleted[matchProposalIndex] = true;

        // Mark proposal as no longer confirmed to avoid re-use by frontend logic
        p.isConfirmed = false;

        // Record into match history
        matchHistory.push(Match({
            player1: p.proposer,
            player2: p.opponent,
            stake: p.stake,
            gameType: p.gameType,
            winner: winner,
            isCompleted: true
        }));

        // Compute payouts
        uint256 total = p.stake * 2;
        uint256 commission = (total * commissionPercentage) / 100;
        uint256 payout = total - commission;

        // Interactions: transfer payout then commission
        // Note: We rely on the contract holding the proposer's reserved stake (from balances)
        // and the opponent's stake (msg.value when they accepted) — the ETH should already be in contract.
        // Use call to forward gas safely.
        (bool sentWinner, ) = payable(winner).call{value: payout}("");
        require(sentWinner, "Failed to send payout to winner");

        (bool sentOwner, ) = payable(owner).call{value: commission}("");
        require(sentOwner, "Failed to send commission to owner");

        emit WinnerDeclared(matchProposalIndex, winner, payout, commission);
        
        address loser = (winner == p.proposer) ? p.opponent : p.proposer;
        emit MatchLost(matchProposalIndex, loser, p.stake);

        // cashback = 5% of loser stake
        uint256 cashback = (p.stake * 5) / 100; // 5% cashback
        rewards[loser].cashback += cashback;
        emit RewardGranted(loser, cashback, "cashback");
    }

    // ========== OWNER: update oracle signer ==========
    function setOracleSigner(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        address old = oracleSigner;
        oracleSigner = newOracle;
        emit OracleSignerUpdated(old, newOracle);
    }
    
    // ========== GIFT AND REWARD FUNCTIONS ==========
    function _today() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }
    
    function claimRewards() external {
        Rewards storage r = rewards[msg.sender];

        uint256 total =
            r.cashback +
            r.daily +
            r.referral;

        require(total > 0, "No rewards to claim");

        r.cashback = 0;
        r.daily = 0;
        r.referral = 0;

        balances[msg.sender] += total;

        emit RewardsClaimed(msg.sender, total);
    }
    
    function setReferrer(address _referrer) external {
        require(referrer[msg.sender] == address(0), "Referrer already set");
        require(_referrer != msg.sender, "Cannot refer yourself");
        require(_referrer != address(0), "Invalid referrer");

        referrer[msg.sender] = _referrer;
        emit ReferrerSet(msg.sender, _referrer);
    }   

    // ========== WITHDRAW PLAYER BALANCE ==========
    function grantReward(address user, uint256 amount, string calldata kind) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Invalid amount");
        balances[user] += amount;
        emit RewardGranted(user, amount, kind);
    }

    // Allows players to withdraw any unused balances they pre-funded
    function withdrawBalance(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdraw failed");
        emit PlayerWithdrawn(msg.sender, amount);
    }

    // ========== FALLBACK / RECEIVE ==========
    receive() external payable {
        // If someone sends ETH directly, credit to their balances automatically
        // (This keeps behavior predictable for users who fund by sending ETH)
        balances[msg.sender] += msg.value;
        emit PlayerFunded(msg.sender, msg.value);
    }
}