# 📊 Vertex Sentinel: Dashboard Design Recommendations

**Target Audience:** Operators & Users monitoring active trades.
**Objective:** Provide a bias-free, functional, and verifiable execution interface that balances deep security audit trails with high-level operational visibility.

---

## 1. Information Architecture & Layout

### A. The "Sentinel Status" Header (Top Bar)
- **Agent Identity:** Display `name` and `version` from `agent-id.json`. Include a copyable `Agent Wallet Address`.
- **System Health:** A "Heartbeat" indicator showing the connection status of the Execution Proxy and Kraken MCP.
- **Fail-Closed Toggle:** A clear, read-only status (e.g., "🛡️ FAIL-CLOSED ARMED") to reassure the operator that risk guardrails are active.
- **Global Actions:** An "Emergency Stop" button (Big Red Button) that triggers a local process kill or a "circuit breaker" on-chain.

### B. The "Command Center" Stats (Top Row)
- **Total Trade Volume:** Real-time aggregate of `amountUsdScaled` for the current session.
- **Session PnL:** (Derived) Calculated by matching BUY/SELL orders from `audit.json` with execution prices.
- **Confidence Trend:** A small sparkline showing the average confidence of the last 10 decisions.
- **Risk Rejections:** A counter of "TradeRejected" events captured from the on-chain logs.

### C. The "Audit Feed" (Central Component)
- **Interleaved View:** Combine the "Decision Checkpoint" (the 'Why') with the "Execution Receipt" (the 'How') into a single logical "Trade Block."
- **Human-Readable Focus:** The primary text should be the `reasoning` string from `explainability.ts`.
- **Integrity Badges:** Every trade should have a "Verified" badge. Clicking it reveals the EIP-712 signature and reasoning hash for deep-dive audits.

---

## 2. Visual Design & Aesthetic (Functional Neutrality)

### A. Color Palette
- **Base:** Deep Slate / Charcoal (#1A202C) - reduces eye strain for long-term monitoring.
- **Accents:**
  - **Success (Authorized):** Emerald (#10B981) instead of bright "Electric Cyan."
  - **Warning (Rejected):** Amber (#F59E0B) for "HOLD" or "REJECTED" states.
  - **Critical (Exception):** Crimson (#EF4444) for "Fail-Closed" triggers or system errors.
- **Typography:** Monospace (e.g., JetBrains Mono) for values and hashes; clean Sans-Serif (Inter) for labels and reasoning.

### B. UI Components
- **Data Tables:** Use fixed headers and paginated/virtualized scrolling for large audit logs.
- **Modals:** Use "Slide-overs" or "Modals" for detailed cryptographic data to keep the main view uncluttered.
- **Progressive Disclosure:** Hide raw hex strings (Signatures, TxHashes) behind "Info" icons or expandable rows.

---

## 3. Interaction Patterns (Control & Feedback)

### A. Manual Overrides
- **Authorization Queue:** For trades with confidence scores between 0.70 and 0.80, implement a "Manual Authorization" UI where the user can sign the intent themselves.
- **Parameter Tuning:** A "Settings" panel to adjust risk thresholds (e.g., "Confidence Threshold") which then updates the `.env` or a local config file (requiring an agent restart).

### B. Audit Deep-Dives
- **Traceability:** Click a `traceId` to highlight all logs (Brain, Strategy, On-Chain, Execution) related to that specific trade intent.
- **On-Chain Verification:** Direct links to Etherscan/Sepolia Explorer for every `txHash` and `RiskRouter` event.

---

## 4. Accessibility & Usability

- **Color-Blind Friendly:** Use icons (✅, ❌, ⚠️) in addition to colors for status indicators.
- **High-Contrast Mode:** Ensure a minimum contrast ratio of 4.5:1 for all text.
- **Keyboard Navigation:** Support `Ctrl+S` for Sync and `Esc` to close modals.

---

## 5. Strategic Roadmap Items (Issues to Create)

1. **WebSocket Migration:** Replace the 5s polling with a real-time event stream from the Execution Proxy.
2. **PnL Engine:** Implement a backend service to calculate real-time PnL by parsing the audit logs.
3. **Multi-Network Support:** Allow the dashboard to toggle between "Local (Hardhat)" and "Sepolia" views.

---
*Prepared by Jules (Sentinel Engineer) | Project Constitution v2.0.0 Compliant*
