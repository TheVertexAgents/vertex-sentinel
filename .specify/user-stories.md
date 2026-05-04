# Vertex Sentinel User Stories

This document outlines the core user stories for the Vertex Sentinel platform, categorized by role. Vertex Sentinel provides a verifiable risk-management layer for autonomous AI trading agents.

## Roles

- **Operator**: The human user who manages, configures, and monitors the trading agent.
- **Agent Brain**: The autonomous AI trading system that makes decisions and executes trades.
- **Auditor**: A third party or regulator who verifies the integrity and compliance of trading activities.

## User Stories

| ID | As a… | I want to… | So that… |
|----|--------|-----------|----------|
| US-01 | Operator | Connect my MetaMask wallet | My agent is linked to my identity |
| US-02 | Operator | Mint an ERC-8004 identity NFT | My agent has a verifiable on-chain identity |
| US-03 | Operator | Set max position size & trades/hour | The agent cannot exceed my risk tolerance |
| US-04 | Operator | See real-time PnL (realized + unrealized) | I know if the agent is profitable |
| US-05 | Operator | See a final session PnL report (profit or loss) | I can evaluate the session outcome clearly |
| US-06 | Operator | Approve or reject high-stakes trades via HITL | I retain human override on large decisions |
| US-07 | Operator | Export a full JSONL audit trail | I can prove every decision to regulators |
| US-08 | Operator | Hit "DE-RISK / HALT" | All positions are closed immediately |
| US-09 | Agent Brain | Read risk parameters from RiskRouter.sol | Every trade intent is within authorized guardrails |
| US-10 | Agent Brain | Sign every trade intent with EIP-712 | Every decision is cryptographically attributable |
| US-11 | Auditor | View each trade's on-chain proof hash | I can independently verify no tampering occurred |

---

## Acceptance Criteria

### US-01: Connect Wallet
- **AC1**: User can click "Connect Wallet" and trigger MetaMask/Web3 provider.
- **AC2**: Successfully connected address is displayed in the UI.
- **AC3**: Dashboard provides a "Demo Mode" fallback if no Web3 provider is detected.

### US-02: Mint Identity NFT
- **AC1**: Operator can initiate the minting of an ERC-8004 identity for their agent.
- **AC2**: The UI displays the status of the minting process (Pending/Success).
- **AC3**: The Agent ID is persisted and used for future operations.

### US-03: Set Risk Parameters
- **AC1**: Operator can use sliders or inputs to define `maxPositionUsd` and `maxTradesPerHour`.
- **AC2**: Parameters are saved on-chain via the `RiskRouter` contract.
- **AC3**: The UI confirms successful parameter authorization.

### US-04: Real-time PnL Monitoring
- **AC1**: Dashboard displays realized PnL from closed trades.
- **AC2**: Dashboard displays unrealized PnL based on current market prices for open positions.
- **AC3**: Metrics update automatically as new data arrives via WebSocket.

### US-05: Final Session Report
- **AC1**: A "Session Report" button is accessible on the dashboard.
- **AC2**: Clicking the button opens a modal showing a comprehensive summary (Profit/Loss, Win Rate, Drawdown).
- **AC3**: The report is generated from a persistent data source (`pnl_report.json`).

### US-06: Human-in-the-Loop (HITL)
- **AC1**: Trades exceeding a specific USD threshold are paused for manual approval.
- **AC2**: Operator is notified and can Approve or Reject the trade in the HITL tab.
- **AC3**: Agent only proceeds with execution after manual approval is received.

### US-07: Export Audit Trail
- **AC1**: Operator can click "Export" to download the full history of agent decisions.
- **AC2**: Export format is standard JSON or JSONL.
- **AC3**: Log includes signatures and technical justifications for each action.

### US-08: Emergency Halt (Panic Button)
- **AC1**: "DE-RISK / HALT" button is prominently displayed in the Operations tab.
- **AC2**: Clicking it triggers an on-chain update to set risk limits to zero.
- **AC3**: Agent Brain acknowledges the halt and stops further trading activity.

### US-09: Risk Guardrail Enforcement
- **AC1**: Agent Brain fetches the latest risk parameters from the blockchain before every trade.
- **AC2**: If a proposed trade exceeds parameters, the Agent Brain fails closed and does not execute.

### US-10: Cryptographic Attribution
- **AC1**: Every trade intent is signed using EIP-712 by the agent's private key.
- **AC2**: The signature is recorded in the audit trail for non-repudiation.

### US-11: Audit Verification
- **AC1**: Each trade in the audit table displays an Arc L1 proof hash.
- **AC2**: Auditors can use this hash to verify the existence and integrity of the trade on the distributed ledger.
