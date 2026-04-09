// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AgentRegistry
 * @notice ERC-8004 compliant AI Agent Identity Registry — each agent is an ERC-721 NFT.
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

    uint256 private _nextAgentId;
    mapping(uint256 => AgentRegistration) public agents;
    mapping(address => uint256) public walletToAgentId;
    mapping(uint256 => uint256) private _signingNonces;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed operatorWallet,
        address indexed agentWallet,
        string name
    );

    constructor()
        ERC721("ERC-8004 Agent Registry", "AGENT")
        EIP712("AgentRegistry", "1")
    {}

    function register(
        address agentWallet,
        string calldata name,
        string calldata description,
        string[] calldata capabilities,
        string calldata agentURI
    ) external returns (uint256 agentId) {
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

        walletToAgentId[agentWallet] = agentId + 1; // 1-indexed to differentiate from zero

        emit AgentRegistered(agentId, msg.sender, agentWallet, name);
    }

    function getAgent(uint256 agentId) external view returns (AgentRegistration memory) {
        return agents[agentId];
    }

    function isRegistered(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }

    function walletToId(address wallet) external view returns (uint256) {
        uint256 id = walletToAgentId[wallet];
        require(id > 0, "Not registered");
        return id - 1;
    }
}
