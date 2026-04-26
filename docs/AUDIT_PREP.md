# Vertex Sentinel: Security & Audit Documentation

## System Architecture
Vertex Sentinel implements a three-layer security model:

1. **Strategic Layer (Genkit AI)**: Performs multi-dimensional risk scoring using LLMs and market data.
2. **On-Chain Layer (RiskRouter.sol)**: Enforces hard limits (Max Position, Trades/Hour) using EIP-712 signed intents.
3. **Execution Layer (ExecutionProxy)**: Performs final slippage checks and executes trades via secure MCP connections to Kraken.

## Smart Contracts
The following contracts are in scope for audit:
- `contracts/RiskRouter.sol`: Core risk enforcement and EIP-712 validation.
- `contracts/AgentRegistry.sol`: ERC-8004 compliant agent identity.
- `contracts/ReputationRegistry.sol`: Decentralized agent performance tracking.

### Known Security Considerations
- **`onlyOwner` in RiskRouter**: Currently a single owner (can be a Gnosis Safe) can change risk parameters for any agent. Mitigation: Use the provided `transferOwnership` script to move ownership to a multi-sig.
- **Default Risk Parameters**: Agents without explicit on-chain parameters are subject to a default cap of 1000 scaled units.
- **Slippage Enforcement**: ExecutionProxy performs a pre-trade price check, but market orders on Kraken may still experience slippage beyond the signed `maxSlippageBps` due to market volatility between the check and execution.

## Key Management
- Support for **Circle WaaS** ensures that agent private keys never exist in raw process memory.
- For local execution, keys are stored in encrypted environment variables or hardware security modules (HSM) recommended for production.
