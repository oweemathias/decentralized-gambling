// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Gambling {
    address public owner;
    uint256 public commissionPercent = 5;

    struct MatchProposal {
        string gameType;
        uint256 stake;
        address proposer;
        bool isConfirmed;
        address opponent;
    }

    struct Match {
        string gameType;
        address player1;
        address player2;
        uint256 stake;
        address winner;
        uint256 timestamp;
    }

    Match[] public completedMatches;

    mapping(address => MatchProposal[]) public proposalsByPlayer;
    mapping(address => uint256) public balances;

    address[] public allProposers;

    event MatchProposed(address indexed proposer, string gameType, uint256 stake);
    event MatchConfirmed(address indexed opponent, address indexed proposer, string gameType);
    event WinnerDeclared(address indexed winner, address indexed loser, string gameType, uint256 reward);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ✅✅✅ NEW FUNCTION ADDED HERE
    function fundPlayer() external payable {
        require(msg.value > 0, "Must send some ETH");
        balances[msg.sender] += msg.value;
    }

    function _createProposal(string memory gameType) internal {
        require(msg.value > 0, "Stake must be greater than zero");

        MatchProposal memory newProposal = MatchProposal({
            gameType: gameType,
            stake: msg.value,
            proposer: msg.sender,
            isConfirmed: false,
            opponent: address(0)
        });

        proposalsByPlayer[msg.sender].push(newProposal);

        if (!hasProposed(msg.sender)) {
            allProposers.push(msg.sender);
        }

        emit MatchProposed(msg.sender, gameType, msg.value);
    }

    function proposeMatch(string memory gameType) external payable {
        _createProposal(gameType);
    }

    function proposeMatchWithTracking(string memory gameType) external payable {
        _createProposal(gameType);
    }

    function hasProposed(address player) internal view returns (bool) {
        for (uint256 i = 0; i < allProposers.length; i++) {
            if (allProposers[i] == player) {
                return true;
            }
        }
        return false;
    }

    function getAllProposers() public view returns (address[] memory) {
        return allProposers;
    }

    function getProposalsByPlayer(address player) public view returns (MatchProposal[] memory) {
        return proposalsByPlayer[player];
    }

    function confirmMatch(address proposer, string memory gameType) external payable {
        require(msg.sender != proposer, "You cannot confirm your own proposal");

        MatchProposal[] storage proposals = proposalsByPlayer[proposer];
        bool found = false;

        for (uint256 i = 0; i < proposals.length; i++) {
            if (
                keccak256(abi.encodePacked(proposals[i].gameType)) == keccak256(abi.encodePacked(gameType)) &&
                !proposals[i].isConfirmed &&
                proposals[i].stake == msg.value
            ) {
                proposals[i].isConfirmed = true;
                proposals[i].opponent = msg.sender;
                found = true;

                emit MatchConfirmed(msg.sender, proposer, gameType);
                break;
            }
        }

        require(found, "No matching proposal found");
    }

    function declareWinner(address winner, address loser, string memory gameType) external onlyOwner {
        require(winner != loser, "Winner and loser cannot be the same");

        MatchProposal[] storage winnerProposals = proposalsByPlayer[winner];
        MatchProposal[] storage loserProposals = proposalsByPlayer[loser];

        MatchProposal memory matchedWinnerProposal;
        bool foundMatch = false;

        for (uint256 i = 0; i < winnerProposals.length; i++) {
            for (uint256 j = 0; j < loserProposals.length; j++) {
                if (
                    keccak256(abi.encodePacked(winnerProposals[i].gameType)) == keccak256(abi.encodePacked(gameType)) &&
                    keccak256(abi.encodePacked(loserProposals[j].gameType)) == keccak256(abi.encodePacked(gameType)) &&
                    winnerProposals[i].isConfirmed &&
                    loserProposals[j].isConfirmed &&
                    winnerProposals[i].stake == loserProposals[j].stake &&
                    (winnerProposals[i].opponent == loser || loserProposals[j].opponent == winner)
                ) {
                    matchedWinnerProposal = winnerProposals[i];
                    foundMatch = true;
                    break;
                }
            }
            if (foundMatch) break;
        }

        require(foundMatch, "Confirmed match not found");

        uint256 totalStake = matchedWinnerProposal.stake * 2;
        uint256 commission = (totalStake * commissionPercent) / 100;
        uint256 reward = totalStake - commission;

        payable(winner).transfer(reward);
        payable(owner).transfer(commission);

        completedMatches.push(Match({
            gameType: gameType,
            player1: matchedWinnerProposal.proposer,
            player2: matchedWinnerProposal.opponent,
            stake: matchedWinnerProposal.stake,
            winner: winner,
            timestamp: block.timestamp
        }));

        emit WinnerDeclared(winner, loser, gameType, reward);
    }

    function getCompletedMatches() public view returns (Match[] memory) {
        return completedMatches;
    }

    function updateCommissionPercent(uint256 newPercent) external onlyOwner {
        require(newPercent <= 10, "Commission too high");
        commissionPercent = newPercent;
    }
}
