# ⚡ Vertex Sentinel

> **Verifiable risk-management for autonomous AI trading agents.**
> EIP-712 signed TradeIntents · On-chain guardrails · Fail-Closed execution · No private key delegation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity&logoColor=white)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![EIP-712](https://img.shields.io/badge/EIP--712-Typed%20Data%20Signing-6f42c1)](https://eips.ethereum.org/EIPS/eip-712)
[![Viem](https://img.shields.io/badge/Viem-2.x-fbbf24)](https://viem.sh)

## 🏗️ Hardened & Verified Architecture

The Vertex Sentinel is a **production-ready risk layer** following the strict **Constitution v2.0.0** standards. It has achieved a 5/5 pass rate on core security tests.

### 🛡️ Security Pillars
- **Fail-Closed Execution**: Critical failures or risk breaches trigger an immediate halt (`CriticalSecurityException`).
- **Strict Type Safety**: Built with TypeScript 5.x and Zod; zero use of `any` types.
- **Verifiable Audit Trail**: Every trade decision generates a cryptographically signed EIP-712 checkpoint stored in `logs/audit.json`.

---

## 📊 Live Monitoring Dashboard

The Sentinel includes a built-in monitoring dashboard to visualize verifiable execution in real-time.

### How to run the Dashboard:

1. **Start the Monitor**:
   ```bash
   npm run dashboard
   ```

2. **Access the UI**:
   Open http://localhost:3000/dashboard/index.html in your browser.

**Features:**
- **Real-Time Audit Feed**: Automatically polls `logs/audit.json` every 5 seconds.
- **Signature Verification**: Visual badges confirm every decision is EIP-712 signed.
- **Human-Readable Explanations**: Deep-dive into the "Why" behind every trade decision.
- **Glassmorphism Theme**: High-fidelity UI matching the Sentinel brand.

---

## ⚡ One-Click Verification

To verify the full infrastructure, run:

```bash
# 1. Run the Security Suite
npm test

# 2. Run the Full-Loop Orchestration
npm run demo
```

---

## Quick Start

### Prerequisites
- **Node.js 20+** (LTS stable)
- `npm` or compatible package manager

### Install & Configure

```bash
git clone https://github.com/TheVertexAgents/vertex-sentinel.git
cd vertex-sentinel
npm install
cp .env.example .env
```

---

## 🛡️ Smart Contract Strengthening (Issue #76)

The Sentinel has been upgraded with a robust suite of on-chain registries aligned with ERC-8004 and EIP-712 standards.

### 🔗 Registry Ecosystem
- **AgentRegistry**: ERC-721 based identity registry (ERC-8004).
- **RiskRouter**: Advanced trade authorization with per-agent risk limits.
- **ReputationRegistry**: On-chain feedback and anti-sybil scoring.
- **ValidationRegistry**: Cryptographic attestations for trade checkpoints.
- **HackathonVault**: Self-serve capital allocation for registered agents.

## Key Contracts

### `RiskRouter.sol`
The on-chain 'bouncer' — intercepts `TradeIntent` structs and enforces:
- **Agent Authorization** — only registered agents can pass.
- **Deadline Enforcement** — rejects intents with `block.timestamp > deadline`.
- **Circuit Breaker** — rejects trades exceeding volume thresholds.
- **EIP-712 Signature Recovery** — recovers signer via `ECDSA.recover()`.

---

## Roadmap

- [x] **Phase 1: Foundation**
- [x] **Phase 2: Security & Identity**
- [x] **Phase 3: Integration & Deployment**
- [x] **Phase 4: Explainability & Monitoring**
- [ ] **Phase 5: Optimization**

---

## License
MIT © VertexAgents
