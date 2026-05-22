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
| **Live Sentiment** | Real-time social/news analysis via LunarCrush V4 API |
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
# Open http://localhost:3005
```

---

### Sentinel Dashboard

The **Vertex Sentinel: Professional Risk Terminal** provides institutional-grade visibility into agent operations:

#### Key Metrics
*   **Sentinel Savings**: The total value of capital risk blocked by the agent (e.g., prevented losses from high-risk trades).
*   **Max Drawdown (MDD)**: The peak-to-trough decline during the current session, ensuring the agent adheres to strict risk bounds.
*   **Sharpe Ratio**: Risk-adjusted return metric calculated in real-time from session volatility and PnL.
*   **Win/Loss Ratio**: Consistency metric tracking the success of agent-approved intents.

#### Features
*   **Risk Terminal**: Integrated TradingView charts and social sentiment heatmaps.
*   **Agent Operations**: Web3-enabled control panel to adjust on-chain risk parameters (Position Limits, Volume Caps) via the `RiskRouter`.
*   **Technical Audit**: A verifiable, EIP-712 signed audit stream showing every trade intent, AI reasoning, and **Arc L1 Verification Proofs**.

#### Accessing the Dashboard
The dashboard is served on port **3005** to avoid conflicts with the AgentStack Orchestrator.

```bash
npm run dashboard
```
Access at **`http://localhost:3006`**.

> **Note**: Ensure the AgentStack Orchestrator is running on port **3000** (as configured in `.env`) to enable data verification features.

---

## 🐳 Docker Usage

Vertex Sentinel is fully containerized for institutional reliability and ease of deployment.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start with Docker Compose

1. **Configure Environment**: Ensure your `.env` file is populated with necessary API keys.
2. **Build and Run**:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```
3. **Access Dashboard**: Open `http://localhost:3006` in your browser.

### Building Manually

```bash
# Build the image
docker build -t vertex-sentinel .

# Run the container
docker run -p 3006:3006 --env-file .env vertex-sentinel
```

### Health Checks

The container includes a built-in health check that monitors the `/api/health` endpoint:
```bash
docker inspect --format='{{json .State.Health}}' vertex-sentinel
```

### Cloud Deployment (GCP)

Vertex Sentinel is designed to run on **Google Cloud Run** for maximum scalability and institutional reliability.

#### 1. Setup Infrastructure
Infrastructure is managed via Terraform in the `terraform/` directory.
```bash
make deploy-infra
```

#### 2. Deploy Application
The included `Makefile` automates the build-push-deploy loop.
```bash
# Build, push to Artifact Registry, and deploy to Cloud Run
make all
```

#### 3. Configuration
Sensitive keys should be passed via Terraform variables or managed through GCP Secret Manager (recommended for production).

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

- **Live Audit Feed** — Polls `logs/audit.json` every 5 seconds.
- **Signature Verification** — Visual badges confirm EIP-712 signing.
- **Explainability** — Human-readable reasoning for every decision.
- **Arc L1 Verification** — Direct links to on-chain transaction proofs for data integrity.
- **Glassmorphism UI** — Professional dark theme with real-time TradingView integration.

---

## 📁 Project Structure

```
vertex-sentinel/
├── contracts/              # Solidity smart contracts
│   ├── RiskRouter.sol
│   ├── AgentRegistry.sol
│   ├── ReputationRegistry.sol
│   └── ValidationRegistry.sol
├── src/
│   ├── execution/          # Execution layer proxy
│   ├── logic/              # Risk assessment flows
│   ├── mcp/                # Model Context Protocol integration
│   ├── onchain/            # On-chain integration clients
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

- [x] **Phase 4**: Integration — Kraken MCP, Live Trading & Sentiment Ingestion
- [ ] **Phase 5**: Expansion — Multi-exchange support & Dynamic Risk modules

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
