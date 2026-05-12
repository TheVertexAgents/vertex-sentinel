# Vertex Sentinel Layer — User Guide

Version: 1.0
Audience: Operators, SREs, Integrators, DevOps

⚠️ Purpose: This document is an operational, production-ready manual describing system initialization, the mathematical Risk Analysis engine, the differences between Paper Mode and Live Mode (with an explicit comparison table), notification and heartbeat internals, and how to read terminal metrics. It includes real-world terminal outputs and worked examples (SOL 32% vs ETH 22%).

---

## Table of Contents

1. Overview
2. Quick start & prerequisites
3. System initialization (deep technical sequence)
   - Real terminal output (Winston JSON format)
4. How trade risk is analyzed — mathematical deep dive
   - Signals and manual penalties
   - AI risk assessment integration
   - Worked example: SOL/USDC → Risk 0.32 (32%)
   - Worked example: ETH/USDC → Risk 0.22 (22%)
   - Operational interpretation
5. Execution modes: Paper Mode vs Live Mode (detailed comparison)
   - Full behavior table
   - Configuration and safety checks
6. Heartbeats and Verification — internals for operators
   - Sequence of attestation
   - Data formats (EIP-712)
   - Failure modes
7. Notifications, alerts, and operator workflows (SOPs)
   - Example payloads
8. Reading terminal & dashboard metrics — practical guide
   - Key endpoints (Quota API)
   - Troubleshooting & triage checklist
9. Appendices
   - Appendix A: Sample .env and risk-engine tuning
   - Appendix B: Future Roadmap (Q3)

---

## 1. Overview

Vertex Sentinel Layer is a verifiable risk-management and execution gating layer for autonomous trading agents. It is intended to:

- Enforce pre-execution safety via EIP-712 signed intents.
- Provide economic attestation using small, verifiable nanopayments (CirclePayments) during heartbeat cycles.
- Anchor signed system state snapshots via heartbeat transactions to an L1 ledger (Sepolia or local).
- Offer both Paper Mode (safe simulation) and Live Mode (real execution) with a Fail-Closed architecture.

This guide assumes familiarity with Node.js, EIP-712 signing, basic exchange connectivity (Kraken), and on-chain verification concepts.

---

## 2. Quick start & prerequisites

Minimum platform requirements:

- Node 18+ (LTS recommended) and npm/yarn
- Wallet for signing EIP-712 intents
- Kraken API access: API key and secret
- Optional: CirclePayments API key (for nanopayment settlement)
- Optional: Telegram bot token for alerts

Essential environment variables (example):

```bash
# Core
AGENT_NAME="Vertex Sentinel Layer"
NETWORK="sepolia"
KRAKEN_PAPER_MODE=true

# Exchange
KRAKEN_API_KEY="your_key"
KRAKEN_SECRET="your_secret"

# AI Provider
AI_PROVIDER="google" # or "groq"
GOOGLE_GENAI_API_KEY="your_key"

# Optional Verification
USE_CIRCLE_WAAS=false
CIRCLE_API_KEY="sk_live_xxx"
```

Install and run:

```bash
npm ci
# Run in paper mode (default if KRAKEN_PAPER_MODE=true)
npm start
```

---

## 3. System initialization (deep technical sequence)

Initialization ensures all security dependencies are satisfied before entering the trading loop:

1. **Bootstrap**: Environment variables are loaded (`dotenv.config()`) to prevent race conditions.
2. **Environment Validation**: `validateEnv()` checks for mandatory keys (Kraken, Infura, etc.).
3. **Metadata Loading**: `agent-id.json` is parsed to set the agent's identity and scaling factors.
4. **On-Chain Sync**: The agent fetches its current nonce from the `RiskRouter` contract.
5. **Market Data initialization**: The `OHLCVCollector` subscribes to WebSocket feeds for BTC, ETH, and SOL.
6. **Execution Proxy Start**: Background listeners for trade execution and event reconciliation are launched.

### Real terminal output (Initialization)

The system uses structured JSON logging via Winston. Below is a representative startup sequence:

```json
{"level":"info","message":"Agent brain script loading...","step":"SCRIPT_LOADING","service":"vertex-sentinel","timestamp":"2026-05-12T22:00:00.000Z"}
{"level":"info","message":"Environment variables successfully validated.","step":"ENV_VALIDATED","service":"vertex-sentinel","timestamp":"2026-05-12T22:00:00.005Z"}
{"level":"info","message":"Agent metadata successfully loaded.","step":"METADATA_LOADED","agentId":1,"name":"Vertex Sentinel Layer","service":"vertex-sentinel","timestamp":"2026-05-12T22:00:00.010Z"}
{"level":"info","message":"VERTEX SENTINEL — LIVE TRADING AGENT","module":"AGENT_BRAIN","step":"STARTUP_BANNER","agentId":1,"wallet":"0x123...","interval":"300s","service":"vertex-sentinel","timestamp":"2026-05-12T22:00:00.015Z"}
{"level":"info","message":"Initial nonce fetched from chain.","module":"AGENT_BRAIN","step":"INITIAL_NONCE","nonce":"1","service":"vertex-sentinel","timestamp":"2026-05-12T22:00:01.000Z"}
{"level":"info","message":"Server started on port 3006","module":"SOCKET_SERVER","step":"SERVER_START","port":3006,"service":"vertex-sentinel","timestamp":"2026-05-12T22:00:01.050Z"}
```

---

## 4. How trade risk is analyzed — mathematical deep dive

Vertex Sentinel uses a hybrid risk model that combines deterministic manual penalties with LLM-based qualitative analysis.

### Signals and manual penalties

The `RiskAssessment` engine calculates a `manualPenalty` (clamped between 0.0 and 1.0) by summing individual risk factors:

- **Spread Penalty**: Up to 0.8. Penalizes wide Bid/Ask spreads.
- **Volatility Penalty**: Up to 0.4. Penalizes high 24h price swings.
- **Volume Penalty**: Up to 0.3. Penalizes large trades relative to liquidity.
- **Sentiment Penalty**: Up to 0.5. Penalizes bearish AI-detected sentiment.
- **News Penalty**: Up to 0.6. Penalizes high-impact negative headlines.

$$manualPenalty = \min(1.0, \sum penalties)$$

### AI Risk Assessment

The agent queries an AI provider (Google or Groq) to provide a `riskScore` (0.0 to 1.0) based on market data, portfolio balance, and news.

### Final Risk Score

The final risk score is the maximum of the manual penalty and the AI's suggested score:

$$RiskScore = \max(manualPenalty, AI\_RiskScore)$$

**Enforcement Logic**: If the `RiskScore` exceeds 0.8 (Confidence < 20%), the trade is blocked (`HOLD`).

### Worked example: SOL/USDC → Risk 0.32 (32%)

1. **Market Signals**: Spread is 0.1%, Volatility is moderate.
2. **Manual Penalty**: Sum of penalties results in 0.15.
3. **AI Score**: AI detects moderate social volatility and suggests a risk of **0.32**.
4. **Result**: `max(0.15, 0.32) = 0.32`. In logs, this appears as a 32% risk assessment.

### Worked example: ETH/USDC → Risk 0.22 (22%)

1. **Market Signals**: Low spread, low volatility.
2. **Manual Penalty**: Sum of penalties is 0.05.
3. **AI Score**: AI sees "Bullish" sentiment and suggests a risk of **0.22**.
4. **Result**: `max(0.05, 0.22) = 0.22`. In logs, this appears as a 22% risk assessment.

---

## 5. Execution modes: Paper Mode vs Live Mode

| Feature | Paper Mode (`KRAKEN_PAPER_MODE=true`) | Live Mode (`KRAKEN_PAPER_MODE=false`) |
| :--- | :--- | :--- |
| **Intent Signing** | EIP-712 signed intents generated | EIP-712 signed intents generated |
| **On-Chain Auth** | Submitted to `RiskRouter` (Sepolia/Local) | Submitted to `RiskRouter` (Mainnet) |
| **Execution** | Simulated fills; no real capital moved | Real fills via Kraken API; real capital moved |
| **PnL Tracking** | Tracked in `logs/pnl.json` (simulated) | Tracked in `logs/pnl.json` (real) |
| **Security** | Fail-Closed gating enforced | Fail-Closed gating enforced |

---

## 6. Heartbeats and Verification

The agent maintains liveness and auditability through heartbeats:

- **Attestation**: Every cycle, the agent posts its state checkpoint to the `ValidationRegistry` contract.
- **Circle Nanopayments**: If `USE_CIRCLE_WAAS` is enabled, heartbeats are attested via a symbolic **0.001 USDC** nanopayment on the Arc L1.
- **Fail-Closed**: If `AGENTSTACK_REQUIRED` is true, the agent must verify its data with the AgentStack orchestrator; otherwise, the trade is blocked.

---

## 7. Notifications and Alerts

The agent emits structured alerts to console and optionally to Telegram:

- **Trade Authorized**: Sent when an intent passes risk checks and is authorized on-chain.
- **Risk Alert**: Sent when `riskScore > 0.6`.
- **HITL Pending**: Sent when a trade exceeds `HITL_THRESHOLD_USD` (default $1,000) and awaits manual approval.

---

## 8. Reading terminal & dashboard metrics

The Vertex Sentinel provides a minimal API for monitoring resource usage and quotas.

### Key Endpoints

- **GET `/api/quota`**: Returns current AI usage metrics for the active provider (Google or Groq).
  - **Sample Response**:
    ```json
    {
      "provider": "groq",
      "dailyUsage": 45,
      "dailyQuota": 14400,
      "remaining": 14355
    }
    ```

### Troubleshooting Checklist

1. **System Halted?**: Check for the presence of `logs/HALTED`. This file is created on critical security failures (e.g., missing API keys).
2. **Trade not executing?**: Check `logs/app.log` for `INTENT_SKIPPED` or `RISK_ASSESSMENT` scores > 0.8.
3. **Nonce Mismatch?**: The agent will automatically attempt to refresh its nonce on the next cycle if a transaction fails.

---

## 9. Appendices

### Appendix A: Sample .env and risk-engine tuning

```bash
# Risk Weights (Internal to LLM prompt)
# Adjust these via the prompt template in risk_assessment.ts
# Global Thresholds
HITL_THRESHOLD_USD=1000
MIN_EXPECTED_ROI=-0.002
```

### Appendix B: Future Roadmap (Q3)

The following features are planned for the Q3 release:
- **Advanced /metrics Endpoint**: Full Prometheus-compatible exporter for Prometheus/Grafana.
- **Operational Shell Scripts**: `nonce_force_sync.sh` and `heartbeat_status.sh` for automated SRE recovery.
- **Unified Risk Dashboard**: Integrated visual terminal combining quota, PnL, and on-chain health in a single glassmorphism UI.
- **Multi-Exchange Support**: Native execution support for Binance and Coinbase International.

---
*End of User Guide.*
