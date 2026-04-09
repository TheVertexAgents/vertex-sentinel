# Vertex Sentinel Agent Memory

## Project Overview
Vertex Sentinel is a verifiable risk management layer for autonomous AI trading agents, designed for the AI Trading Agents Hackathon 2026 ($55K prize pool).

## Key Features
- **EIP-712 Signed Intents**: Cryptographic signatures for every trade decision
- **On-Chain Guardrails**: RiskRouter.sol enforces position limits, circuit breakers
- **Fail-Closed Architecture**: Any validation failure = HALT immediately
- **Dual Challenge Integration**: Both ERC-8004 and Kraken CLI challenges

## Design System
- **Colors**: Cyan (#00E5FF), Purple (#7C3AED), Obsidian (#0B0E14), Emerald (#10B981), Crimson (#EF4444), Amber (#F59E0B)
- **Style**: Glassmorphism, dark theme, radial gradients
- **Fonts**: Inter (UI) + JetBrains Mono (code)

## Key Files
- `pitch-deck.html` - 11-slide HTML presentation for hackathon
- `dashboard/index.html` - Live monitoring UI
- `LIVE_EXECUTION_PROOF.md` - Evidence of 4 real Kraken trades
- `docs/LITEPAPER.md` - Technical whitepaper
- `contracts/RiskRouter.sol` - On-chain guardrails contract

## Build & Run
```bash
# Start local server
cd /workspace/project/vertex-sentinel
python3 -m http.server 12000

# Access pitch deck
# https://work-1-uhwrkhvbjvrzuhbf.prod-runtime.all-hands.dev/pitch-deck.html

# Access dashboard
# https://work-1-uhwrkhvbjvrzuhbf.prod-runtime.all-hands.dev/dashboard/index.html
```

## Execution Evidence
- **4 Live BTC/USD trades** executed on April 5, 2026
- **Kraken Order IDs**: LIVE-IHNIDEAJ, LIVE-J5YTJ2Z6, LIVE-CA0ZKG18, LIVE-5ERBD4KX
- **Total Volume**: 0.00050 BTC
- **Success Rate**: 100% (4/4)
- **All EIP-712 signatures verified**

## Repository Structure
- `/contracts` - Solidity contracts (RiskRouter.sol)
- `/src/execution` - Trade execution proxy
- `/src/logic` - Risk assessment flows
- `/src/mcp` - Model Context Protocol integration
- `/dashboard` - Live monitoring UI
- `/docs` - Documentation (Litepaper, SDK guides)
- `/scripts` - Deployment and execution scripts
- `/test` - Test suites

## Hackathon Challenges
1. **ERC-8004 Challenge**: Agent identity registry, reputation tracking
2. **Kraken CLI Challenge**: Live trading via MCP, real market data

## Important Notes
- Contract deployed on Sepolia: `0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC`
- Agent Address: `0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9`
- Audit trail stored in `logs/audit.json`
