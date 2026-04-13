# ERC-8004 Cleanliness Audit & Mock Data Discovery Report
**Date:** April 13, 2026
**Agent:** Vertex Sentinel
**Status:** High Priority Audit

## 1. Executive Summary
This report details the presence of mock and hardcoded data within the Vertex Sentinel agent codebase. These findings directly impact the agent's standing on the ERC-8004 leaderboard, specifically affecting **Validation Scores** and **Reputation**.

## 2. Methodology
The audit was conducted using a multi-layered approach:
1. **Automated Discovery:** A recursive shell script scanned for keywords (`mock`, `placeholder`, `todo`, `fallback`, `DEMO_MODE`, etc.) and specific hardcoded constants.
2. **Contextual Analysis:** High-risk files (`src/onchain/`, `src/logic/`) were manually reviewed to distinguish between development mocks and production-path vulnerabilities.
3. **ERC-8004 Alignment Check:** Validation logic was cross-referenced against the standard's requirements for cryptographic proof and verifiable heartbeats.

## 3. Critical Findings

### 3.1 Hardcoded Validation Scores
In both the core logic and submission scripts, the validation score (which should be a dynamic assessment of agent performance) is hardcoded to a maximum of 100.

*   **Location:** `src/onchain/validation.ts`, Line 80
*   **Proof:** `args: [agentId, checkpointHash, 100, 1, '0x', notes],`
*   **Location:** `scripts/hackathon_submit.ts`, Line 157
*   **Proof:** `args: [agentId, checkpointHash, 100, 1, '0x', "Hackathon submission"]`

### 3.2 Mock Cryptographic Proofs
The `proof` field in `ValidationRegistry` attestations, intended for TEE or EIP-712 proofs, is currently empty or mock.

*   **Location:** `src/onchain/validation.ts`, Line 80
*   **Proof:** `args: [..., 100, 1, '0x', notes]` (The `'0x'` indicates no actual proof is being submitted).
*   **Impact:** This reduces the verifiability of the agent's actions to zero, making it look like a "fake" heartbeat.

### 3.3 Bypassed Identity Checks (Demo Mode)
Identity and registration checks are bypassed using a `DEMO_MODE` environment variable or zero-address checks, which could lead to deployment of an unregistered agent.

*   **Location:** `src/onchain/identity.ts`, Line 23
*   **Proof:** `if (this.registryAddress === '0x000...0' || process.env.DEMO_MODE === 'true') { return true; }`
*   **Location:** `src/onchain/risk_router.ts`, Line 150
*   **Proof:** Similar guard for `RiskRouter` submission.

### 3.4 Placeholder Asset Resolution & Pricing
Strategic logic relies on a placeholder for canonical asset metadata and a hardcoded fallback price for PnL tracking.

*   **Location:** `src/logic/agent_brain.ts`, Line 72
*   **Proof:** `console.warn('[PRISM] Using placeholder resolution - real API integration pending');`
*   **Location:** `src/logic/agent_brain.ts`, Line 133
*   **Proof:** `realPrice = 67000;` (Hardcoded fallback when MCP fails).

### 3.5 Fallback Risk Assessment
When AI or MCP engines are unavailable, the system defaults to a "HOLD" decision with a hardcoded risk score of 1.0.

*   **Location:** `src/logic/strategy/risk_assessment.ts`, Line 270
*   **Proof:** `riskScore: 1.0, reasoning: 'Fallback: AI/MCP Engine unavailable in local mode'`

## 4. ERC-8004 Impact Analysis

| Finding | Impact on Score | Reasoning |
| :--- | :--- | :--- |
| **Hardcoded Score (100)** | Reputation Risk | Constant high scores without proof are flagged by validators as suspicious/sybil-like. |
| **Empty Proof ('0x')** | Critical Validation | ERC-8004 requires verifiable artifacts. Empty proofs result in a "Zero Proof" penalty on the leaderboard. |
| **DEMO_MODE Bypasses** | Security/Identity | Allows execution by unregistered agents, failing the "Registered Identity" requirement of the challenge. |
| **Fallback Pricing** | PnL Accuracy | Inaccurate ROI calculations (verifiable via EIP-712 checkpoints) lead to reputation penalties for "deceptive reporting". |

## 5. Remediation Roadmap

1.  **Dynamic Validation:** Implement a `calculateValidationScore()` function that weights PnL, risk assessment, and MCP health.
2.  **Cryptographic Proofs:** Update `postHeartbeat` to include the actual EIP-712 signature of the checkpoint in the `proof` field.
3.  **Strict Identity:** Disable `DEMO_MODE` in `production` and require valid contract addresses in `deployments_sepolia.json`.
4.  **Real API Integration:** Connect to the `PrismAPI` for asset resolution and implement a multi-source price oracle fallback.

## 6. Appendix: Scan Proof
Full raw logs of discovery are available in `REPORTS/scan_raw_data.log`.

### 3.6 Leftover Test Contracts
A `MockRegistry.sol` contract remains in the `contracts/test/` directory. While not in the main production path, its presence in the repository can be flagged during automated code audits.

*   **Location:** `contracts/test/MockRegistry.sol`
*   **Proof:** `contract MockRegistry { ... }`

### 3.7 Hardcoded Agent ID in Local Config
The `agent-id.json` file, used to identify the agent across the codebase, contains a hardcoded ID that may not match the actual registration on Sepolia.

*   **Location:** `agent-id.json`
*   **Proof:** `"agentId": 1`
*   **Impact:** If the agent is registered with a different ID on the official registry (which it likely is, as ID 1 is usually a placeholder), heartbeat attestations will be credited to the wrong agent.
