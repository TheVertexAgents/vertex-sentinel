// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./AgentRegistry.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract RiskRouter is EIP712, Ownable2Step {
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

    AgentRegistry public immutable agentRegistry;

    mapping(uint256 => RiskParams)  public riskParams;
    mapping(uint256 => TradeRecord) private _tradeRecords;
    mapping(uint256 => uint256)     private _intentNonces;
    mapping(string => address)      public priceFeeds;

    event TradeAuthorized(
        bytes32 indexed intentHash,
        address indexed agent,
        string pair,
        string action,
        uint256 amountUsdScaled,
        uint256 maxSlippageBps
    );
    event TradeApproved(uint256 indexed agentId, bytes32 indexed intentHash, uint256 amountUsdScaled);
    event TradeRejected(uint256 indexed agentId, bytes32 indexed intentHash, string reason);
    event RiskParamsSet(uint256 indexed agentId, uint256 maxPositionUsdScaled, uint256 maxTradesPerHour);
    event PriceFeedSet(string pair, address feed);

    constructor(address _registry) EIP712("VertexAgents-Sentinel", "1") Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_registry);
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

    function setPriceFeed(string calldata pair, address feed) external onlyOwner {
        priceFeeds[pair] = feed;
        emit PriceFeedSet(pair, feed);
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

        // Task 2.1: On-chain Price Verification via Chainlink
        address feed = priceFeeds[intent.pair];
        if (feed != address(0)) {
            (, int256 price,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
            require(price > 0, "Invalid price");
            require(block.timestamp - updatedAt < 1 hours, "Price feed stale");

            // In a real implementation, we would use 'price' to verify 'amountUsdScaled'
            // if amountUsdScaled was derived from a token amount.
            // Currently Vertex Sentinel uses amountUsdScaled directly as the intent.
        }

        (approved, reason) = _validateRisk(intent.agentId, intent.amountUsdScaled);
        if (!approved) {
            emit TradeRejected(intent.agentId, digest, reason);
            return (false, reason);
        }

        _intentNonces[intent.agentId]++;
        _recordTrade(intent.agentId);

        emit TradeAuthorized(
            digest,
            signer,
            intent.pair,
            intent.action,
            intent.amountUsdScaled,
            intent.maxSlippageBps
        );
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
            if (amountUsdScaled > 100000) return (false, "No risk params: exceeds 1000 default cap");
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
