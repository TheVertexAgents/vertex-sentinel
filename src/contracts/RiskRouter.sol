// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./AgentRegistry.sol";

contract RiskRouter is EIP712 {
    using ECDSA for bytes32;

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

    event TradeAuthorized(bytes32 indexed intentHash, address indexed agent, string pair, uint256 amountUsdScaled);
    event TradeApproved(uint256 indexed agentId, bytes32 indexed intentHash, uint256 amountUsdScaled);
    event TradeRejected(uint256 indexed agentId, bytes32 indexed intentHash, string reason);
    event RiskParamsSet(uint256 indexed agentId, uint256 maxPositionUsdScaled, uint256 maxTradesPerHour);

    constructor(address _registry) EIP712("VertexAgents-Sentinel", "1") {
        owner = msg.sender;
        agentRegistry = AgentRegistry(_registry);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "RiskRouter: not owner");
        _;
    }

    function setRiskParams(
        uint256 agentId,
        uint256 maxPositionUsdScaled,
        uint256 maxDrawdownBps,
        uint256 maxTradesPerHour
    ) external onlyOwner {
        riskParams[agentId] = RiskParams({
            maxPositionUsdScaled: maxPositionUsdScaled,
            maxDrawdownBps: maxDrawdownBps,
            maxTradesPerHour: maxTradesPerHour,
            active: true
        });
        emit RiskParamsSet(agentId, maxPositionUsdScaled, maxTradesPerHour);
    }

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

    function submitTradeIntent(
        TradeIntent calldata intent,
        bytes calldata signature
    ) external returns (bool approved, string memory reason) {
        bytes32 digest = hashTradeIntent(intent);

        if (block.timestamp > intent.deadline) {
            emit TradeRejected(intent.agentId, digest, "Intent Expired");
            return (false, "Intent Expired");
        }

        if (intent.nonce != _intentNonces[intent.agentId]) {
            emit TradeRejected(intent.agentId, digest, "Invalid Nonce");
            return (false, "Invalid Nonce");
        }

        AgentRegistry.AgentRegistration memory reg = agentRegistry.getAgent(intent.agentId);
        if (intent.agentWallet != reg.agentWallet) {
            emit TradeRejected(intent.agentId, digest, "Agent Wallet Mismatch");
            return (false, "Agent Wallet Mismatch");
        }

        address signer = digest.recover(signature);
        if (signer != reg.agentWallet) {
            emit TradeRejected(intent.agentId, digest, "Invalid Signature");
            return (false, "Invalid Signature");
        }

        (approved, reason) = _validateRisk(intent.agentId, intent.amountUsdScaled);
        if (!approved) {
            emit TradeRejected(intent.agentId, digest, reason);
            return (false, reason);
        }

        _intentNonces[intent.agentId]++;
        _recordTrade(intent.agentId);

        emit TradeAuthorized(digest, signer, intent.pair, intent.amountUsdScaled);
        emit TradeApproved(intent.agentId, digest, intent.amountUsdScaled);
        return (true, "");
    }

    function authorizeTrade(TradeIntent calldata intent, bytes calldata signature) external returns (bool) {
        (bool approved, ) = this.submitTradeIntent(intent, signature);
        return approved;
    }

    function _validateRisk(uint256 agentId, uint256 amountUsdScaled) internal view returns (bool, string memory) {
        RiskParams storage params = riskParams[agentId];
        if (!params.active) {
            if (amountUsdScaled > 100000) return (false, "No risk params: exceeds 000 default cap");
        } else {
            if (amountUsdScaled > params.maxPositionUsdScaled) return (false, "Exceeds maxPositionSize");
            TradeRecord storage record = _tradeRecords[agentId];
            uint256 currentCount = (block.timestamp >= record.windowStart + 1 hours) ? 0 : record.count;
            if (currentCount >= params.maxTradesPerHour) return (false, "Exceeds maxTradesPerHour");
        }
        return (true, "");
    }

    function _recordTrade(uint256 agentId) internal {
        TradeRecord storage record = _tradeRecords[agentId];
        if (block.timestamp >= record.windowStart + 1 hours) {
            record.windowStart = block.timestamp;
            record.count = 1;
        } else {
            record.count++;
        }
    }

    function getIntentNonce(uint256 agentId) external view returns (uint256) {
        return _intentNonces[agentId];
    }
}
