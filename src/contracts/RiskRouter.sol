// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title IAgentRegistry
 * @dev Interface for ERC-8004 compatible Agent Registry.
 */
interface IAgentRegistry {
    function isRegisteredAgent(address agent) external view returns (bool);
}

/**
 * @title RiskRouter
 * @dev The "Bouncer" for VertexAgents Sentinel Layer.
 * Intercepts Trade Intents and validates them against risk guardrails and Agent identity.
 */
contract RiskRouter is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(uint256 agentId,address agentWallet,string pair,string action,uint256 amountUsdScaled,uint256 maxSlippageBps,uint256 nonce,uint256 deadline)"
    );

    struct TradeIntent {
        uint256 agentId;
        address agentWallet;
        string pair;
        string action;
        uint256 amountUsdScaled;
        uint256 maxSlippageBps;
        uint256 nonce;
        uint256 deadline;
    }

    event TradeAuthorized(bytes32 indexed intentHash, address indexed agent, string pair, uint256 amountUsdScaled);
    event TradeRejected(bytes32 indexed intentHash, string reason);

    address public agentRegistry;
    mapping(address => bool) public authorizedAgents;

    constructor(address _registry) EIP712("VertexAgents-Sentinel", "1") {
        agentRegistry = _registry;
        // Keep msg.sender authorized for fallback/demo
        authorizedAgents[msg.sender] = true;
    }

    /**
     * @dev Reconstructs the hash of a TradeIntent.
     */
    function hashTradeIntent(TradeIntent memory intent) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            TRADE_INTENT_TYPEHASH,
            intent.agentId,
            intent.agentWallet,
            keccak256(bytes(intent.pair)),
            keccak256(bytes(intent.action)),
            intent.amountUsdScaled,
            intent.maxSlippageBps,
            intent.nonce,
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

        if (!authorizedAgents[signer] && (agentRegistry == address(0) || !IAgentRegistry(agentRegistry).isRegisteredAgent(signer))) {
            emit TradeRejected(digest, "Unauthorized or Unregistered Agent");
            return false;
        }

        if (block.timestamp > intent.deadline) {
            emit TradeRejected(digest, "Intent Expired");
            return false;
        }

        // Circuit Breaker: Example logic for volume limit ($100,000 demo cap)
        if (intent.amountUsdScaled > 10000000) { 
             emit TradeRejected(digest, "Circuit Breaker: Amount Exceeded");
             return false;
        }

        emit TradeAuthorized(digest, signer, intent.pair, intent.amountUsdScaled);
        return true;
    }

    function addAgent(address agent) external {
        // Simplified auth for demo
        authorizedAgents[agent] = true;
    }
}
