# Vertex Sentinel: Git Merge Audit & Verification Report
**Date:** April 27, 2026
**Auditor:** Jules (AI Software Engineer)
**Status:** Completed Deep Scan & Diff Analysis

## 1. Executive Summary
In the last 24-48 hours, three major Pull Requests (#136, #113, #135) were merged into the `main` branch. While the product has overall moved forward with significant features (Geographic Restrictions, Shadow Trading Mode, Circle WaaS Simulation), a "Backward Regression" occurred during the merge of **PR #113**.

PR #113 originated from a legacy branch (`smart-contract-strengthening`) created several days ago. When squashed and merged, it introduced brittle code patterns into `src/onchain/risk_router.ts` that bypassed the resilient multi-provider fallback mechanism established in earlier commits. Furthermore, the mismatch between the massive scale of the #113 source branch and the minimal files actually merged has left several "ghost" components (like the `EventReconciler`) present in the codebase but disconnected from the main execution loop.

---

## 2. Merge Timeline & Impact

| Commit | PR | Description | Impact |
| :--- | :--- | :--- | :--- |
| `bdf9e6e` | #133 | Institutional Optimization & Expansion | **FORWARD:** Established robust multi-provider RPC fallbacks and PnL metrics. |
| `2b80b81` | #136 | Mainnet Launch Plan Docs & Circle WaaS | **FORWARD:** Added Circle WaaS simulation check in `agent_brain.ts`. |
| `fb7d834` | **#113** | **Verification Plan & Data Accuracy** | **BACKWARD:** Reverted resilient RPC logic to brittle, hardcoded Infura calls. |
| `71d41ce` | #135 | Merge PR #135 (Geo-Restrictions) | **FORWARD:** Added mandatory IP-based geographic enforcement and Shadow Mode logs. |

---

## 3. File-by-File Analysis

### `src/onchain/risk_router.ts`
*   **Status:** ⚠️ **Regression Detected**
*   **What Happened:** In commit `bdf9e6e`, the system used a `getTransport()` method that utilized `viem`'s `fallback` to switch between Infura and Alchemy. PR #113 (`fb7d834`) overwrote the `signIntent` method to use a hardcoded `http(process.env.INFURA_KEY ...)` call.
*   **Result:** If Infura is down or rate-limited, signing will fail even if Alchemy keys are provided.

### `src/logic/agent_brain.ts`
*   **Status:** ✅ **Forward Progress**
*   **What Happened:** This file successfully integrated the cumulative changes from all three PRs. It now correctly handles:
    1.  **Circle WaaS Simulation** (`0xCIRCLE` tx hash check).
    2.  **Geographic Restriction Enforcement** (Fail-Closed IP check).
    3.  **Shadow Trading Mode** (Conditional logging when `KRAKEN_PAPER_MODE=true`).
*   **Note:** The PRISM API integration was verified and is active.

### `src/execution/reconciler.ts`
*   **Status:** ℹ️ **Inert/Disconnected**
*   **What Happened:** The file exists and contains institutional-grade SQLite reconciliation logic, but it is **not imported or initialized** in `agent_brain.ts`.
*   **Result:** Authorized trades that fail to execute on Kraken are not currently being automatically retried by the background loop.

### `contracts/RiskRouter.sol` & `AgentRegistry.sol`
*   **Status:** ✅ **Strengthened**
*   **What Happened:** Ownership logic was upgraded to `Ownable2Step` and `Ownable` to support Gnosis Safe multi-sigs.

---

## 4. Identified Regressions (The "Backward" Moves)
1.  **Brittle Signing Transport:** The `RiskRouterClient.signIntent` method no longer uses the resilient transport layer.
2.  **Mock Dependency Regression:** PR #113 modified `mock_kraken.sh` to handle `-o json` flags in a way that might conflict with more recent MCP server expectations regarding raw JSON output.
3.  **Dependency Fragmentation:** `package.json` was updated with `sqlite3` and `node-fetch` to support the reconciler, but the main entry point doesn't yet leverage these tools.

---

## 5. Remediation Steps (Code Fixes)

### Step 1: Restore Resilient Transport in `risk_router.ts`
Replace the hardcoded `http()` call in `signIntent` with the class's existing `getTransport()` method.

**Location:** `src/onchain/risk_router.ts`
```typescript
<<<<<<< SEARCH
      const client = createWalletClient({
        account,
        chain: this.getChain(),
        transport: http(process.env.INFURA_KEY ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}` : undefined),
      });
=======
      const client = createWalletClient({
        account,
        chain: this.getChain(),
        transport: this.getTransport(),
      });
>>>>>>> REPLACE
```

### Step 2: Activate the Event Reconciler
Wired the persistent SQLite loop into `agent_brain.ts` to ensure reliability.

**Location:** `src/logic/agent_brain.ts` (Initialization section)
```typescript
import { EventReconciler } from '../execution/reconciler.js';
import ExecutionProxy from '../execution/proxy.js';

// ... inside main()
const proxy = new ExecutionProxy(config.riskRouter as Hex, process.env.NETWORK || 'local');
const reconciler = new EventReconciler(config.riskRouter as Hex, process.env.NETWORK || 'local', proxy);
reconciler.start(); // Start background reconciliation
```

### Step 3: Cleanup `mock_kraken.sh`
Ensure the mock script correctly handles the MCP server's call style without dropping critical flags.

---

## 6. Conclusion
The "backward" feeling was caused by a **sub-optimal merge of PR #113**, which favored older, less resilient code over the optimizations in the "Institutional" update. However, the core business logic and new high-level features remain intact. Applying the remediation steps above will restore the system to its peak performance and reliability.
