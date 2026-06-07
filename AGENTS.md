# Vertex Sentinel Agent Memory

## Project Overview
Vertex Sentinel is a verifiable risk management layer for autonomous AI trading agents, designed for the AI Trading Agents Hackathon 2026.

## Key Features
- **EIP-712 Signed Intents**: Cryptographic signatures for every trade decision.
- **On-Chain Guardrails**: RiskRouter.sol enforces position limits and circuit breakers.
- **CCXT Integration**: Support for over 100+ exchanges including Binance, Kraken, and Coinbase.
- **Fail-Closed Architecture**: Any validation failure results in an immediate system HALT.
- **Multi-User Dashboards**: Secure session management and collaborative risk monitoring.

## Design System
- **Colors**: Cyan (#00E5FF), Purple (#7C3AED), Obsidian (#0B0E14), Emerald (#10B981), Crimson (#EF4444), Amber (#F59E0B).
- **Style**: Institutional minimalist glassmorphism.
- **Fonts**: Plus Jakarta Sans (UI) + JetBrains Mono (code).

## Build & Run
```bash
# Install dependencies
npm install

# Start unified server (REST + Socket.io + Dashboard)
npm start

# Run stress test suite
npm run test:stress
```

## Repository Structure
- `/packages/sentinel-sdk` - Reusable SDK for pluggable agents.
- `/src/execution` - Adapters (ccxt, Binance), OrderManager, and Fast-Path execution.
- `/src/logic` - Strategy assessment, OrderBookService, and Portfolio Rebalancing.
- `/src/orchestrator` - Unified Socket.io server and API versioning.
- `/dashboard` - Institutional Risk Terminal and Login.

## Hackathon & Institutional Progress
1. **ERC-8004 Alignment**: Completed agent identity and reputation registry integration.
2. **Exchange Depth**: Full CCXT integration with support for 50+ pairs and real-time L2 order books.
3. **Execution Speed**: Sub-second fast-path implemented with EIP-712 template caching.
4. **Security Hardening**: JWT-style auth, SQLite session persistence, and Binance weight-system throttling.

## Recovery & Maintenance
- **HALTED State**: System enters HALT on critical failures. Force restart: `npm start -- --force-restart`.
- **API Versioning**: Sentinel supports `/v1/api` for backward compatibility.
- **API Key Rotation**: Use `POST /api/keys/rotate` to cycle encrypted Sentinel access keys.
