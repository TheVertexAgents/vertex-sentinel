# 📊 Vertex Sentinel: Modern Dashboard Design Recommendations

**Target Audience:** Operators & Users monitoring active trades.
**Objective:** Provide a robust, neutral, and verifiable execution interface that balances deep security audit trails with high-level operational visibility.

---

## 1. Information Architecture & Layout (Modernized)

Based on our repository analysis and analysis of existing templates, the dashboard should adopt a **"Modular Card-and-Grid"** layout to improve information density without cluttering the UI.

### A. Global Monitoring Header (The "Control Bar")
- **Agent Identity & Version:** Clearly display the Agent Name (e.g., "Vertex Sentinel Alpha") and version from `agent-id.json`.
- **System Heartbeat:** A pulsing indicator (e.g., Emerald for Online, Crimson for Offline) connected to the Kraken MCP and RiskRouter health.
- **Fail-Closed Status Badge:** A "Glassmorphism" badge stating "🛡️ FAIL-CLOSED ACTIVE" to confirm safety guardrails.
- **Global Actions:**
    - **SYNC:** Manual refresh of the `audit.json` feed.
    - **EMERGENCY STOP:** A high-contrast action to halt all trading activity immediately.

### B. KPI & Performance Metrics (Top Row Cards)
- **Total Checkpoints:** Aggregate count of all trade intents logged in `audit.json`.
- **Signed Attestations:** Count of unique EIP-712 signatures, providing confidence in execution integrity.
- **Session Profit/Loss:** A dynamic ticker showing PnL calculated from matched BUY/SELL execution prices.
- **Confidence Trend:** A small sparkline visualization of the `confidenceScaled` field across recent trades.

### C. The "Live Execution Grid" (New: Visibility Layer)
*Inspired by the `LIVE_EXECUTION_DASHBOARD.html` template.*
- **Recent Activity Cards:** A horizontally scrolling or grid-based view showing the last 3-5 trades with high-level details:
    - **Pair & Action Badge** (e.g., `BUY BTC/USD`)
    - **Amount & Confidence Percentage**
    - **Integrity Status** (e.g., "✅ EIP-712 Signed")
- **Progressive Disclosure:** Clicking a card should expand to reveal the `signature` hex string and the `reasoningHash`.

### D. Deep-Dive Execution History (Bottom Table)
- **Interleaved Data:** Merge the "Trade Intent" (checkpoint) with its corresponding "Execution Result" (order result) in a single row.
- **Human-Readable Explanation:** Use the full `reasoning` string as the primary detail, with a "Deep-Dive" icon to view the raw JSON trace.
- **Audit Traceability:** Provide direct links to the on-chain `txHash` and the `intentHash` for external verification on Sepolia Explorer.

---

## 2. Visual Design & Aesthetic (Functional Neutrality)

### A. Theme: "Sentinel Obsidian" (Glassmorphism)
To maintain neutrality while achieving a modern feel, use a "Glassmorphism" approach:
- **Base:** Deep Obsidian (#0B0E14) or Charcoal (#1A202C).
- **Cards:** Semi-transparent white (5-10% opacity) with a `backdrop-filter: blur(12px)`.
- **Accents:**
  - **Authorized:** Emerald (#10B981) - standard for success.
  - **Rejected/Hold:** Amber (#F59E0B) - standard for caution.
  - **Exception:** Crimson (#EF4444) - standard for critical errors.

### B. Typography & Accessibility
- **Fonts:** Clean Sans-Serif (Inter) for headers and reasoning; Monospace (JetBrains Mono) for hashes, addresses, and volume values.
- **Color-Blind Support:** Never rely on color alone; use icons (✅, ❌, 🛡️) for status.
- **Contrast:** Ensure all text passes WCAG AA contrast standards against the semi-transparent cards.

---

## 3. Interaction Patterns (Advanced Control)

### A. Manual Risk Thresholding
- **Threshold Slider:** A UI element to dynamically adjust the "Confidence Threshold" (currently 0.80). Changes should generate a local config update and restart the agent's monitoring loop.
- **Authorization Queue:** An "Inbox" style view for trade intents that fall just below the confidence threshold, allowing an operator to manually authorize via a browser-based wallet.

### B. WebSocket Migration (Roadmap)
- **Zero-Latency Feed:** Transition from 5s polling to a WebSocket stream from the Execution Proxy for instant event visualization (as per `ISSUE_MIGRATION_WEBSOCKET.md`).

---
*Prepared by Jules (Sentinel Engineer) | Project Constitution v2.0.0 | Verifiable Execution Protocol*
