# ⚡ Vertex Sentinel

> **Verifiable risk-management for autonomous AI trading agents.**  
> EIP-712 signed TradeIntents · On-chain guardrails · Fail-Closed execution · No private key delegation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity&logoColor=white)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![EIP-712](https://img.shields.io/badge/EIP--712-Typed%20Data%20Signing-6f42c1)](https://eips.ethereum.org/EIPS/eip-712)
[![Viem](https://img.shields.io/badge/Viem-2.x-fbbf24)](https://viem---

## 🏗️ Hardened & Verified Architecture

The Vertex Sentinel is now a **production-hardened infrastructure** with 5/5 passing security tests.

```
┌─────────────────┐     EIP-712 Signed      ┌──────────────────────┐     TradeAuthorized      ┌─────────────────┐
│                 │      TradeIntent         │                      │         Event            │                 │
│  INTENT LAYER   │ ──────────────────────► │  SENTINEL LAYER      │ ───────────────────────► │ EXECUTION LAYER │
│  agent_brain.ts │                         │  RiskRouter.sol      │                          │  proxy.ts       │
│                 │                         │                      │                          │                 │
│  • Signs intent │                         │  • Verifies sig      │     TradeRejected ✗      │  • Submits to   │
│  • No key hand- │                         │  • Checks deadline   │ ◄─── (fail-closed) ───── │    exchange     │
│    over         │                         │  • Circuit breakers  │                          │  • Kraken API   │
└─────────────────┘                         └──────────────────────┘                          └─────────────────┘
```

### ⚡ One-Click Verification

To verify the full infrastructure, run:

```bash
# 1. Run the Security Suite (5/5 Passing)
npm test

# 2. Run the Full-Loop Orchestration (One Command)
npm run demo
```

---

## Quick Start

### Prerequisites

- **Node.js 18+** (LTS stable)
- `npm` or compatible package manager

### Install & Configure

```bash
git clone https://github.com/TheVertexAgents/vertex-sentinel.git
cd vertex-sentinel
npm install
cp .env.example .env
# Set GOOGLE_GENAI_API_KEY and AGENT_PRIVATE_KEY
```

### Run the Agent Brain (Intent + Signing Demo)

```bash
npm start
```

**Expected Output:**
```text
VertexAgents Sentinel Brain Initialization...
[Genkit] Running risk assessment for BTC/USDC trade...
[Agent Brain] Risk Score: 0.1 (Standard trade parameters)
[Agent Brain] Intent Layer: Signing trade for BTC/USDC...
--- AUTHORIZATION ARTIFACT ---
{ isAllowed: true, reason: 'Standard parameters', signature: '0x...' }
```

### Run the Full Sentinel Demo (On-Chain Orchestration)

```bash
npm run demo
```

**Expected Output:**
```text
⚡ VERTEX SENTINEL — FULL DEMO FLOW ⚡
[Step 1] Deploying MockRegistry...
[Step 2] Deploying RiskRouter (Sentinel Layer)...
[Step 5] Submitting intent to on-chain Sentinel...
✅ SENTINEL VERDICT: TRADE AUTHORIZED
[Step 6] Execution Proxy: Processing authorized trade...
[KRAKEN] 📤 Submitting order... ✅ Accepted (Order: K-445651)
```

### Compile Smart Contracts

```bash
npm run compile
```

---

## Key Contracts

### `RiskRouter.sol`

The on-chain "bouncer" — intercepts `TradeIntent` structs and enforces:

- **Agent Authorization** — only registered agents can pass (`authorizedAgents` mapping)
- **Deadline Enforcement** — rejects intents with `block.timestamp > deadline`
- **Circuit Breaker** — rejects trades exceeding 100 ETH volume
- **EIP-712 Signature Recovery** — recovers signer via `ECDSA.recover()`
- **ERC-8004 Identity** — fallback check against the global Agent Registry

---

## Tech Stack (Stabilized)

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin 5.x, Hardhat 2.22.x |
| Signing / Web3 | Viem 2.x (EIP-712 `signTypedData`) |
| AI Layer | **Google Genkit** (risk scoring flows) |
| Runtime | **TypeScript 5.x**, Node.js 18+ (CommonJS stable) |

---

## Roadmap

- [x] EIP-712 TradeIntent signing (Intent Layer)
- [x] On-chain RiskRouter with circuit breakers (Sentinel Layer)
- [x] ExecutionProxy event routing (Execution Layer)
- [x] Spec-first YAML architecture
- [x] **Genkit risk-scoring flow** wired into signing path
- [x] **ERC-8004 agent registry** integration
- [x] **Full security test suite** (5/5 passing)
- [ ] Deploy RiskRouter to testnet (Sepolia)
it (risk scoring flows) |
| Runtime | TypeScript 5.x, Node.js ESM |
| Standard | EIP-712 (Typed Structured Data Signing) |
| Agent Registry | ERC-8004 (referenced) |

---

## Roadmap

- [x] EIP-712 TradeIntent signing (Intent Layer)
- [x] On-chain RiskRouter with circuit breakers (Sentinel Layer)
- [x] ExecutionProxy event routing (Execution Layer)
- [x] Spec-first YAML architecture
- [ ] Deploy RiskRouter to testnet (Sepolia)
- [ ] Genkit risk-scoring flow wired into signing path
- [ ] ERC-8004 agent registry integration
- [ ] Full test suite

---

## Contributing

This project is a hackathon submission under active development.  
Frontend work items: [Notion →](https://asifdotpy.notion.site/Frontend-Work-Items-Vertex-Sentinel-Landing-Page-3346566cd850815daa63d22c12c71cba)

---

## License

MIT © VertexAgents
