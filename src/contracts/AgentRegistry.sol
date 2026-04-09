// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AgentRegistry
 * @notice ERC-8004 compliant AI Agent Identity Registry — each agent is an ERC-721 NFT.
 *
 * Each token URI points to an Agent Registration JSON (off-chain or IPFS) containing:
 *   { name, description, capabilities[], agentWallet, endpoints[], version }
 *
 * EIP-712 support: agents can sign typed messages that are verifiable against their
 * registered agentWallet — linking off-chain AI actions to on-chain identity.
 */
contract AgentRegistry is ERC721URIStorage, EIP712 {
    struct AgentRegistration {
        address operatorWallet;
        address agentWallet;
        string  name;
        string  description;
        string[] capabilities;
        uint256 registeredAt;
        bool    active;
    }

    bytes32 public constant AGENT_MESSAGE_TYPEHASH = keccak256(
        "AgentMessage(uint256 agentId,address agentWallet,uint256 nonce,bytes32 contentHash)"
    );

    uint256 private _nextAgentId = 1;
    mapping(uint256 => AgentRegistration) public agents;
    mapping(address => uint256) public walletToAgentId;
    mapping(uint256 => uint256) private _signingNonces;

    event AgentRegistered(uint256 indexed agentId, address indexed operatorWallet, address indexed agentWallet, string name);
    event AgentWalletUpdated(uint256 indexed agentId, address newAgentWallet);
    event AgentDeactivated(uint256 indexed agentId);

    constructor() ERC721("ERC-8004 Agent Registry", "AGENT") EIP712("VertexAgents-Sentinel", "1") {}

    /**
     * @notice Register a new AI agent — mints an ERC-721 token to the caller.
     */
    function register(
        address agentWallet,
        string calldata name,
        string calldata description,
        string[] calldata capabilities,
        string calldata agentURI
    ) external returns (uint256 agentId) {
        require(bytes(name).length > 0, "AgentRegistry: name required");
        require(agentWallet != address(0), "AgentRegistry: invalid agentWallet");
        require(walletToAgentId[agentWallet] == 0, "AgentRegistry: agentWallet already registered");

        agentId = _nextAgentId++;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        agents[agentId] = AgentRegistration({
            operatorWallet: msg.sender,
            agentWallet: agentWallet,
            name: name,
            description: description,
            capabilities: capabilities,
            registeredAt: block.timestamp,
            active: true
        });

        walletToAgentId[agentWallet] = agentId;
        emit AgentRegistered(agentId, msg.sender, agentWallet, name);
    }

    /**
     * @notice Update the agent's hot signing wallet.
     */
    function updateAgentWallet(uint256 agentId, address newAgentWallet) external {
        require(ownerOf(agentId) == msg.sender, "AgentRegistry: not token owner");
        require(newAgentWallet != address(0), "AgentRegistry: invalid wallet");

        address old = agents[agentId].agentWallet;
        delete walletToAgentId[old];

        agents[agentId].agentWallet = newAgentWallet;
        walletToAgentId[newAgentWallet] = agentId;

        emit AgentWalletUpdated(agentId, newAgentWallet);
    }

    /**
     * @notice Update the agent's metadata URI.
     */
    function updateAgentURI(uint256 agentId, string calldata newURI) external {
        require(ownerOf(agentId) == msg.sender, "AgentRegistry: not token owner");
        _setTokenURI(agentId, newURI);
    }

    /**
     * @notice Deactivate an agent.
     */
    function deactivate(uint256 agentId) external {
        require(ownerOf(agentId) == msg.sender, "AgentRegistry: not token owner");
        agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }

    function isRegisteredAgent(address agentWallet) external view returns (bool) {
        return walletToAgentId[agentWallet] != 0;
    }

    function isRegistered(uint256 agentId) public view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }

    function getAgent(uint256 agentId) external view returns (AgentRegistration memory) {
        require(isRegistered(agentId), "AgentRegistry: nonexistent token");
        return agents[agentId];
    }

    function getSigningNonce(uint256 agentId) external view returns (uint256) {
        return _signingNonces[agentId];
    }

    function verifyAgentSignature(
        uint256 agentId,
        bytes32 contentHash,
        bytes calldata signature
    ) external view returns (bool valid) {
        AgentRegistration storage reg = agents[agentId];
        bytes32 structHash = keccak256(abi.encode(
            AGENT_MESSAGE_TYPEHASH,
            agentId,
            reg.agentWallet,
            _signingNonces[agentId],
            contentHash
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        return recovered == reg.agentWallet;
    }

    function incrementNonce(uint256 agentId) external {
        require(ownerOf(agentId) == msg.sender, "AgentRegistry: not token owner");
        _signingNonces[agentId]++;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
