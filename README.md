<div align="center">

# ⚡ Vertex Sentinel

### The Open-Source, Trustless Standard for Verifiable, Non-Custodial Agentic Execution

**EIP-712 Signed Intents · On-Chain Guardrails · Fail-Closed Execution · Zero Private Key Delegation**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity&logoColor=white)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![EIP-712](https://img.shields.io/badge/EIP--712-Typed%20Data%20Signing-6f42c1)](https://eips.ethereum.org/EIPS/eip-712)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Agent%20Identity-10B981)](https://eips.ethereum.org/EIPS/eip-8004)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)

[📖 Documentation](docs/LITEPAPER.md) · [🎯 Live Demo](dashboard/index.html) · [📊 Pitch Deck](pitch-deck.html) · [🔗 Deployed Contract](https://sepolia.etherscan.io/address/0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC)

</div>

---

## 🏆 AI Trading Agents Hackathon 2026

> **Dual Challenge Submission**: ERC-8004 Agent Identity + Kraken CLI Trading

| Challenge | Status | Evidence |
|-----------|--------|----------|
| **ERC-8004** | ✅ Complete | Agent Registry, Reputation Scoring, Validation Attestations |
| **Kraken CLI** | ✅ Complete | 4 Live BTC/USD trades executed with full audit trail |

📄 **[View Live Execution Proof →](LIVE_EXECUTION_PROOF.md)**

---

## 🎯 The Problem

The current Agentic Economy (ARMA, Mamo, ZyFAI) relies on **"Black-Box" backends** where users delegate private keys to opaque company servers.

| Risk | Impact | Current Solutions |
|------|--------|-------------------|
| 🤖 **Hallucinations** | Agent swaps 100 ETH instead of 1.0 ETH | Advisory warnings only |
| 🔓 **Key Compromise** | Attacker drains all funds instantly | Manual intervention required |
| 📊 **Market Volatility** | Stale prices cause massive slippage | No automated circuit breakers |

**Current AI safety tools are advisory—they warn, but don't stop bad trades.**

### The Vertex Gap: Why We're Different

| Feature | Legacy AI Agents (ARMA, Mamo, etc.) | Vertex Sentinel |
|---------|-------------------------------------|-----------------|
| **Security** | Proprietary, Centralized Backend | Auditable Smart Contract Logic |
| **Trust** | "Trust the Company" | "Trust the Contract" (On-chain proof) |
| **Execution** | Private APIs (Opaque) | Kraken CLI + On-chain Intent Logs |
| **Validation** | None (Black Box) | ERC-8004 Validation Artifacts |

---

## 💡 The Solution: Fail-Closed Architecture

Vertex Sentinel introduces a **3-layer security architecture** that makes unauthorized trades impossible:

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERTEX SENTINEL ARCHITECTURE                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   INTENT     │───▶│   SENTINEL   │───▶│  EXECUTION   │      │
│  │   LAYER      │    │   LAYER      │    │   LAYER      │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│        │                    │                    │              │
│        ▼                    ▼                    ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ TradeIntent  │    │ RiskRouter   │    │ Execution    │      │
│  │ + EIP-712    │    │ Circuit      │    │ Proxy        │      │
│  │ Signature    │    │ Breakers     │    │ (Kraken)     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│  ❌ Any failure = HALT (No funds moved)                        │
│  ✅ All checks pass = Execute with audit trail                 │
└─────────────────────────────────────────────────────────────────┘
```

### 🛡️ Security Pillars

| Pillar | Implementation |
|--------|----------------|
| **Fail-Closed** | Any validation failure triggers `CriticalSecurityException` |
| **Cryptographic Signing** | Every trade requires EIP-712 typed data signature |
| **On-Chain Verification** | RiskRouter.sol enforces limits before execution |
| **Full Audit Trail** | Immutable logs in `logs/audit.json` with reasoning |

---

## 🚀 Live Execution Proof

**4 Real BTC/USD Trades** executed on April 5, 2026 via Kraken API:

| Trade | Order ID | Amount | Price | Signature |
|-------|----------|--------|-------|-----------|
| #1 | `LIVE-IHNIDEAJ` | 0.00011 BTC | $67,345.80 | `0xd685...621c` |
| #2 | `LIVE-J5YTJ2Z6` | 0.00012 BTC | $67,345.70 | `0xb1aa...5d1b` |
| #3 | `LIVE-CA0ZKG18` | 0.00013 BTC | $67,345.80 | `0xdd15...711c` |
| #4 | `LIVE-5ERBD4KX` | 0.00014 BTC | $67,351.70 | `0x9300...1e1c` |

**Total Volume**: 0.00050 BTC | **Success Rate**: 100% | **All Signatures Verified** ✅

---

## 📦 Quick Start

### Prerequisites
- **Node.js 20+** (LTS)
- **npm** or compatible package manager

### Installation

```bash
git clone https://github.com/TheVertexAgents/vertex-sentinel.git
cd vertex-sentinel
npm install
cp .env.example .env
```

### Run Tests

```bash
# Full security test suite
npm test

# Full orchestration demo
npm run demo
```

### Launch Dashboard

```bash
npm run dashboard
# Open http://localhost:3000/dashboard/index.html
```

---

## 🔗 Smart Contract Ecosystem

Deployed on **Sepolia Testnet**:

| Contract | Address | Purpose |
|----------|---------|---------|
| **RiskRouter** | [`0xd6A6...FdBC`](https://sepolia.etherscan.io/address/0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC) | Trade authorization & circuit breakers |
| **AgentRegistry** | ERC-8004 | Agent identity (ERC-721 based) |
| **ReputationRegistry** | On-chain | Anti-sybil scoring & feedback |
| **ValidationRegistry** | On-chain | Cryptographic attestations |
| **HackathonVault** | On-chain | Capital allocation for agents |

### RiskRouter.sol Features

```solidity
// Core enforcement mechanisms:
✓ Agent Authorization — Only registered agents can trade
✓ Deadline Enforcement — Rejects stale intents (block.timestamp > deadline)
✓ Circuit Breaker — Rejects trades exceeding volume thresholds
✓ EIP-712 Recovery — Verifies signatures via ECDSA.recover()
```

---

## 📊 Monitoring Dashboard

Real-time visualization of verifiable execution:

- **Live Audit Feed** — Polls `logs/audit.json` every 5 seconds
- **Signature Verification** — Visual badges confirm EIP-712 signing
- **Explainability** — Human-readable reasoning for every decision
- **Glassmorphism UI** — Professional dark theme with gradients

---

## 📁 Project Structure

```
vertex-sentinel/
├── src/
│   ├── contracts/          # Solidity smart contracts
│   │   ├── RiskRouter.sol
│   │   ├── AgentRegistry.sol
│   │   ├── ReputationRegistry.sol
│   │   └── ValidationRegistry.sol
│   ├── execution/          # Execution layer proxy
│   ├── logic/              # Risk assessment flows
│   ├── mcp/                # Model Context Protocol integration
│   └── utils/              # EIP-712 signing utilities
├── dashboard/              # Monitoring UI
├── scripts/                # Deployment & execution scripts
├── test/                   # Comprehensive test suite
├── docs/                   # Documentation
│   ├── LITEPAPER.md
│   ├── SDK_QUICKSTART.md
│   └── WHITEPAPER.md
└── logs/                   # Audit trail storage
```

---

## 🗺️ Roadmap

- [x] **Phase 1**: Foundation — Core architecture & EIP-712 signing
- [x] **Phase 2**: Security — Fail-closed execution & circuit breakers
- [x] **Phase 3**: Identity — ERC-8004 agent registry & reputation
- [x] **Phase 4**: Integration — Kraken MCP & live trading
- [ ] **Phase 5**: Optimization — Multi-exchange support & dynamic risk modules

---

## 🤝 Contributing

We welcome contributions! Please see our development workflow:

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/vertex-sentinel.git

# Install dependencies
npm install

# Run tests before submitting
npm test
```

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the AI Trading Agents Hackathon 2026**

[🔗 Linktree](https://linktr.ee/vertexagents) · [🐙 GitHub](https://github.com/TheVertexAgents) · [📧 Contact](mailto:info.vertexagents@gmail.com)

</div>
