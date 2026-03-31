# ⚡ Vertex Sentinel

> **Verifiable risk-management for autonomous AI trading agents.**  
> EIP-712 signed TradeIntents · On-chain guardrails · Fail-Closed execution · No private key delegation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity&logoColor=white)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![EIP-712](https://img.shields.io/badge/EIP--712-Typed%20Data%20Signing-6f42c1)](https://eips.ethereum.org/EIPS/eip-712)
[![Viem](https://img.shields.io/badge/Viem-2.x-fbbf24)](https://viem.sh)
[![Hardhat](https://img.shields.io/badge/Hardhat-3.x-f9cc0b)](https://hardhat.org)
[![Genkit](https://img.shields.io/badge/Google%20Genkit-AI%20Layer-4285f4?logo=google)](https://firebase.google.com/docs/genkit)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.x-4e5ee4)](https://openzeppelin.com)

---

## 🏆 Hackathon Submission

**Event:** AI Trading Agents Hackathon  
**Track:** Verifiable Agent Safety / DeFi Infrastructure  
**Docs:** [Notion Workspace →](https://asifdotpy.notion.site/VertexAgents-The-Sentinel-Layer-3306566cd850803395c0e8d0cf85d6f7)

---

## The Problem

AI trading agents today operate as black boxes. They require **full private key delegation**, execute without **cryptographic proof** of authorization, and have **no circuit breakers** to prevent catastrophic over-execution. One compromised agent = total fund loss.

---

## The Solution: The Sentinel Layer

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

### How It Works

1. **Agent constructs a `TradeIntent`** — `agentId`, `pair`, `volume`, `maxPrice`, `deadline`
2. **Agent signs via EIP-712** — cryptographic proof with no private key transfer
3. **`RiskRouter.authorizeTrade()`** validates:  
   ✓ Valid EIP-712 signature → ✓ Registered agent → ✓ Deadline not expired → ✓ Volume under circuit breaker
4. **Fail-Closed** — `TradeAuthorized` event triggers `ExecutionProxy`; `TradeRejected` drops the request entirely

---

## Architecture

```
src/
├── logic/
│   ├── agent_brain.ts      # Intent Layer: EIP-712 signing with viem
│   └── types.ts            # Shared types: TradeIntent, Authorization, ValidationArtifact
├── contracts/
│   └── RiskRouter.sol      # Sentinel Layer: on-chain EIP-712 verification + circuit breakers
└── execution/
    └── proxy.ts            # Execution Layer: routes authorized intents to exchange
```

### Spec-First Design

All data contracts and behavior definitions live in `.specify/spec/`:

| Spec | Purpose |
|---|---|
| `vertex-sentinel.yaml` | `TradeIntent` entity + `submit_intent` behavior with guardrails |
| `handshake.yaml` | Protocol contract between Agent Brain and Risk Router |

---

## Quick Start

### Prerequisites

- Node.js 20+
- `npm` or compatible package manager

### Install

```bash
git clone https://github.com/VertexAgents/vertex-sentinel.git
cd vertex-sentinel
npm install
```

### Configure

```bash
cp .env.example .env
# Edit .env and set your AGENT_PRIVATE_KEY (for demo only — use a throwaway key)
```

### Run the Agent Brain (Intent + Signing Demo)

```bash
npm start
```

Expected output:
```
VertexAgents Sentinel Brain Initialization...
[PRISM] Resolving canonical metadata for BTC/USDC...
[Agent Brain] Intent Layer: Signing trade for BTC/USDC...
--- AUTHORIZATION ARTIFACT ---
{ isAllowed: true, reason: 'EIP-712 Signature Generated', signature: '0x...' }
--- END ---
```

### Compile Smart Contracts

```bash
npx hardhat compile
```

---

## Key Contracts

### `RiskRouter.sol`

The on-chain "bouncer" — intercepts `TradeIntent` structs and enforces:

- **Agent Authorization** — only registered agents can pass (`authorizedAgents` mapping)
- **Deadline Enforcement** — rejects intents with `block.timestamp > deadline`
- **Circuit Breaker** — rejects trades exceeding volume threshold (configurable)
- **EIP-712 Signature Recovery** — recovers signer via `ECDSA.recover()`

```solidity
function authorizeTrade(TradeIntent memory intent, bytes memory signature)
    public returns (bool)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin 5.x, Hardhat 3.x |
| Signing / Web3 | Viem 2.x (EIP-712 `signTypedData`) |
| AI Layer | Google Genkit (risk scoring flows) |
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
