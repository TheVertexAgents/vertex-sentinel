# 🛠️ Vertex Sentinel Project Roadmap (Hackathon)

## Milestone 1: Sentinel Core Refactor (SDK-Ready)
*Goal: Decouple security logic from demo orchestration and prepare for pluggable integration.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[BUG]** Fix hardcoded `verifyingContract` in `agent_brain.ts` | `P0: Critical` | `DONE` ✅ |
| **[REFACTOR]** Extract `SentinelClient` into reusable SDK structure | `P1: Feature` | `DONE` ✅ |
| **[TECH DEBT]** Implement automatic type generation from YAML specs | `P2: DevEx` | `DONE` ✅ |

## Milestone 2: Intelligent Verifiability (Genkit + Audit)
*Goal: Enhance the risk engine and provide verifiable "proofs" of security.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[FEATURE]** Implement "Security Audit Trail" generator (JSON/Markdown) | `P1: Demo` | `DONE` ✅ |
| **[ENHANCEMENT]** Strengthen Genkit risk assessment flow with market context | `P2: Research` | `DONE` ✅ |
| **[FEATURE]** Integration of real-time ERC-8004 Identity Verification | `P2: Strategic` | `DONE` ✅ |

## Milestone 3: Productization & Marketing (GTM)
*Goal: Positioning the Sentinel Layer as a "Security SDK" for the OpenServ ecosystem.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[DOCS]** Create `LITEPAPER.md` (Security Strategy & Value Prop) | `P1: Marketing` | `DONE` ✅ |
| **[DOCS]** Draft "Developer Quick-Start" Guide for SDK | `P2: Marketing` | `DONE` ✅ |
| **[RESEARCH]** OpenServ SDK Integration & Conceptual API Design | `P1: Research` | `DONE` ✅ |
| **[DEMO]** Create "One-Click Fail-Closed" simulation script | `P1: Demo` | `DONE` ✅ |

---

## 🗓️ June 2026 Sprint: Institutional Hardening (v1.1.0)
*Goal: Transitioning from hackathon demo to production-safe platform.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[SECURITY]** API Rate Limiting & Socket Throttling | `P0: Critical` | `DONE` ✅ |
| **[SECURITY]** Encrypted API Key Management & Rotation | `P0: Critical` | `DONE` ✅ |
| **[SDK]** Publish-ready `@vertex-agents/sentinel-sdk@1.0.0` | `P1: Feature` | `DONE` ✅ |
| **[RESILIENCE]** ExecutionProxy Auto-Recovery & Backoff | `P1: Feature` | `DONE` ✅ |
| **[UX]** Testnet Faucet Integration in Onboarding | `P2: DevEx` | `DONE` ✅ |
| **[UX]** Live Leaderboard (On-Chain Reputation) | `P1: Demo` | `DONE` ✅ |
| **[EXPANSION]** Binance Adapter (Scaffold + Auth) | `P2: Strategic` | `DONE` ✅ |
| **[STRATEGY]** Kelly Criterion Position Sizing | `P2: Strategic` | `DONE` ✅ |

---

## 🏷️ Label Definitions:
- `P0: Critical`: Essential for any functional demo or security integrity.
- `P1: Feature`: High-impact features that drive the "Security SDK" narrative.
- `P1: Demo`: Enhancements specifically for the "Wow Factor" during screen-sharing.
- `P1: Marketing`: Essential for hackathon requirements and project positioning.
- `P1: Research`: Documentation of integration patterns and future architecture.
- `P2: DevEx`: Developer experience improvements for long-term project health.
- `P2: Research`: Deeper R&D items for the future roadmap.
- `P2: Strategic`: Long-term ecosystem alignment (e.g., ERC-8004).

---

## 🗓️ June 2026: Rest of Month (v1.4.0)
*Goal: Multi-exchange depth, advanced order types, and institutional readiness.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[SECURITY]** JWT-style Auth Middleware & SQLite Sessions | `P0: Critical` | `DONE` ✅ |
| **[SECURITY]** Binance Weight-System Throttling | `P1: Feature` | `DONE` ✅ |
| **[UX]** Multi-User Dashboard Login & Beta Program | `P1: Demo` | `DONE` ✅ |
| **[EXPANSION]** Full CCXT Integration Layer | `P1: Feature` | `DONE` ✅ |
| **[EXPANSION]** Advanced Order Types (OCO/Stop-Limit) | `P1: Feature` | `DONE` ✅ |
| **[DATA]** Real-Time L2 Order Book & Market Impact | `P2: Strategic` | `DONE` ✅ |
| **[PERF]** Sub-Second Fast-Path (Template Caching) | `P1: Feature` | `DONE` ✅ |
| **[API]** Backward-Compatible Versioning (/v1/api) | `P2: DevEx` | `DONE` ✅ |
| **[STRATEGY]** Portfolio Rebalancing Scaffold | `P2: Strategic` | `DONE` ✅ |
| **[QA]** Extreme Market Stress Test Suite | `P1: Demo` | `DONE` ✅ |

---

## 🚀 Post-Hackathon Optimization (Next Steps)
*Goal: Scalability, reliability, and institutional-grade performance.*

| Issue | Priority | Status |
| :--- | :--- | :--- |
| **[PERF]** Sepolia Stability & Nonce Management Optimization | `High` | `DONE` ✅ |
| **[PERF]** Dashboard WebSocket Migration (Socket.io) | `High` | `DONE` ✅ |
| **[FEATURE]** Dynamic Agent Identity & Multi-Tenancy | `Medium` | `DONE` ✅ |
| **[FEATURE]** Genkit-Powered Dynamic Risk Sizing | `Medium` | `DONE` ✅ |
| **[INDUSTRY 5.0]** High-Stakes Human-in-the-Loop Approval Module | `High` | `DONE` ✅ |
| **[EXPANSION]** Multi-Asset & Exchange Support (Coinbase/Binance) | `Low` | `IN_PROGRESS` 🚧 |
| **[INDUSTRY 5.0]** ESG & Sustainability Scoring in RiskCalibrator | `Medium` | `STAGED` ⏳ |
| **[ANALYTICS]** Compliance Report Generation (PDF Audit Logs) | `Low` | `DONE` ✅ |
| **[TECH DEBT]** Fix dangling MCP Server connections in tests | `Medium` | `DONE` ✅ |
