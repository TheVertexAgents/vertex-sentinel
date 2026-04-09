// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./AgentRegistry.sol";

/**
 * @title RiskRouter
 * @dev On-chain risk validation and intent submission.
 */
contract RiskRouter is EIP712 {
    struct TradeIntent {
        uint256 agentId;
        address agentWallet;
        string  pair;
        string  action;
        uint256 amountUsdScaled;
        uint256 maxSlippageBps;
        uint256 nonce;
        uint256 deadline;
    }

    struct RiskParams {
        uint256 maxPositionUsdScaled;
        uint256 maxDrawdownBps;
        uint256 maxTradesPerHour;
        bool    active;
    }

    struct TradeRecord {
        uint256 count;
        uint256 windowStart;
    }

    bytes32 public constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(uint256 agentId,address agentWallet,string pair,string action,uint256 amountUsdScaled,uint256 maxSlippageBps,uint256 nonce,uint256 deadline)"
    );

    address public owner;
    AgentRegistry public immutable agentRegistry;

    mapping(uint256 => RiskParams)  public riskParams;
    mapping(uint256 => TradeRecord) private _tradeRecords;
    mapping(uint256 => uint256)     private _intentNonces;

    event TradeApproved(uint256 indexed agentId, bytes32 indexed intentHash, uint256 amountUsdScaled);
    event TradeRejected(uint256 indexed agentId, bytes32 indexed intentHash, string reason);

    constructor(address agentRegistryAddress)
        EIP712("RiskRouter", "1")
    {
        owner = msg.sender;
        agentRegistry = AgentRegistry(agentRegistryAddress);
    }

    function setRiskParams(
        uint256 agentId,
        uint256 maxPositionUsdScaled,
        uint256 maxDrawdownBps,
        uint256 maxTradesPerHour
    ) external {
        riskParams[agentId] = RiskParams({
            maxPositionUsdScaled: maxPositionUsdScaled,
            maxDrawdownBps: maxDrawdownBps,
            maxTradesPerHour: maxTradesPerHour,
            active: true
        });
    }

    function submitTradeIntent(
        TradeIntent calldata intent,
        bytes calldata signature
    ) external returns (bool approved, string memory reason) {
        if (block.timestamp > intent.deadline) {
            return (false, "Intent expired");
        }

        AgentRegistry.AgentRegistration memory reg = agentRegistry.getAgent(intent.agentId);
        require(intent.agentWallet == reg.agentWallet, "RiskRouter: agentWallet mismatch");

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                TRADE_INTENT_TYPEHASH,
                intent.agentId,
                intent.agentWallet,
                keccak256(bytes(intent.pair)),
                keccak256(bytes(intent.action)),
                intent.amountUsdScaled,
                intent.maxSlippageBps,
                intent.nonce,
                intent.deadline
            ))
        );
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == reg.agentWallet, "RiskRouter: invalid signature");

        RiskParams storage params = riskParams[intent.agentId];
        if (params.active && intent.amountUsdScaled > params.maxPositionUsdScaled) {
            emit TradeRejected(intent.agentId, digest, "Exceeds maxPositionSize");
            return (false, "Exceeds maxPositionSize");
        }

        emit TradeApproved(intent.agentId, digest, intent.amountUsdScaled);
        return (true, "");
    }
}
