# Environment Matrix - Vertex Sentinel

| Key | Purpose | Required for | Origin |
| :--- | :--- | :--- | :--- |
| `AGENT_PRIVATE_KEY` | EIP-712 signing & on-chain interaction | Staging/Prod | Secrets Vault |
| `PRIVATE_KEY` | Deployment & maintenance tasks | Staging/Prod | Secrets Vault |
| `NETWORK` | Target network (e.g., sepolia, mainnet) | All | Config |
| `STRYKR_PRISM_API` | Canonical asset resolution | All | External API |
| `INFURA_KEY` | RPC connectivity for Ethereum/Sepolia | All | External API |
| `GROQ_API_KEY` | AI provider for risk assessment | All | External API |
| `KRAKEN_API_KEY` | Live trading execution on Kraken | Staging/Prod | Secrets Vault |
| `KRAKEN_SECRET` | Live trading execution on Kraken | Staging/Prod | Secrets Vault |
| `KRAKEN_PAPER_MODE` | Toggle between real and simulated trading | All | Config |
| `AGENTSTACK_REQUIRED` | Enable/Disable AgentStack (Arc L1) integration | All | Config |
| `AGENT_STACK_URL` | Endpoint for AgentStack service | All | Config |
| `HITL_THRESHOLD_USD` | USD threshold for Human-in-the-Loop approval | All | Config |

## Storage Instructions
- **Staging/Production**: Store all `*_KEY`, `*_SECRET`, and `PRIVATE_KEY` in a secure vault (e.g., AWS Secrets Manager, GitHub Secrets).
- **Local**: Use `.env` file (never commit).
