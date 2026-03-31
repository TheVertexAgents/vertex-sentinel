// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title RiskRouter
 * @dev The "Bouncer" for VertexAgents Sentinel Layer.
 * Intercepts Trade Intents and validates them against risk guardrails and Agent identity.
 */
contract RiskRouter is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(string agentId,string pair,uint256 volume,uint256 maxPrice,uint256 deadline)"
    );

    struct TradeIntent {
        string agentId;
        string pair;
        uint256 volume;
        uint256 maxPrice;
        uint256 deadline;
    }

    event TradeAuthorized(bytes32 indexed intentHash, address indexed agent);
    event TradeRejected(bytes32 indexed intentHash, string reason);

    mapping(address => bool) public authorizedAgents;

    constructor() EIP712("VertexAgents-Sentinel", "1") {
        // Hardcoded authorized agent for demo
        authorizedAgents[msg.sender] = true;
    }

    /**
     * @dev Reconstructs the hash of a TradeIntent.
     */
    function hashTradeIntent(TradeIntent memory intent) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            TRADE_INTENT_TYPEHASH,
            keccak256(bytes(intent.agentId)),
            keccak256(bytes(intent.pair)),
            intent.volume,
            intent.maxPrice,
            intent.deadline
        )));
    }

    /**
     * @dev Validates a trade intent and its signature.
     */
    function authorizeTrade(
        TradeIntent memory intent,
        bytes memory signature
    ) public returns (bool) {
        bytes32 digest = hashTradeIntent(intent);
        address signer = digest.recover(signature);

        if (!authorizedAgents[signer]) {
            emit TradeRejected(digest, "Unauthorized Agent");
            return false;
        }

        if (block.timestamp > intent.deadline) {
            emit TradeRejected(digest, "Intent Expired");
            return false;
        }

        // Circuit Breaker: Example logic for volume limit
        if (intent.volume > 100 * 1e18) { // Arbitrary limit for demo
             emit TradeRejected(digest, "Circuit Breaker: Volume Exceeded");
             return false;
        }

        emit TradeAuthorized(digest, signer);
        return true;
    }

    function addAgent(address agent) external {
        // Simplified auth for demo
        authorizedAgents[agent] = true;
    }
}
