# Vertex Sentinel: Comprehensive Mock & Simulation Audit Report

**Date:** April 28, 2026
**Auditor:** Jules (AI Software Engineer)
**Status:** Audit Complete - Action Required for Production Readiness

## 1. Verification Script Results (`scripts/verify_no_mocks.sh`)
The verification script was updated to target current codebase patterns and executed with the following results:

```
🔍 Verifying no mocks or bypasses in production paths...
❌ FAIL: circle.ts still contains isSimulated bypass logic
❌ FAIL: circle.ts still contains mock payment hash generation
⚠️  WARN: MockRegistry.sol found in contracts/test/ directory
src/logic/pnl/tracker.ts:      sessionId: 'session-' + Math.random().toString(36).substring(2, 10),
❌ FAIL: Unexpected Math.random() found in source (possible mock/simulation)
❌ Some checks failed. The agent is not production-ready.
```

---

## 2. Detailed Mock Categorization

### Category A: Production Blockers (Simulation Bypasses)
These logic paths bypass real on-chain or external service interactions and must be addressed before a "Live" mainnet release.

1.  **`src/onchain/circle.ts`**:
    - `isSimulated` flag defaults to `true` if `CIRCLE_API_KEY` is missing.
    - Generates a mock payment proof `0x_sim_payment_...` using `Math.random()`.
2.  **`src/onchain/risk_router.ts`**:
    - `authorizeTrade` returns a hardcoded `0xCIRCLE` transaction hash when `USE_CIRCLE_WAAS` is enabled, simulating contract execution.
3.  **`src/onchain/validation.ts`**:
    - `postHeartbeat` uses a `signMessage` placeholder for Circle-based proofs instead of a real EIP-712 attestation.

### Category B: Acceptable Simulation Logic (Approved)
These are intentional "simulation" features maintained for the hackathon/demo phase.

1.  **`KRAKEN_PAPER_MODE`**: Properly implemented across `agent_brain.ts` and `KrakenMcpServer`. It honors the toggle by using `paper` subcommands in the Kraken CLI.
2.  **`src/utils/compliance-report.ts`**: Generates structured text files instead of PDFs. User confirmed this is acceptable for the current release.

### Category C: Hardcoded Fallbacks & Degraded Modes
Logic that provides "safe" default values when external APIs are unreachable.

1.  **`src/logic/strategy/news_feed.ts`**: `getNeutralFallback` returns 0.5 sentiment for all assets if LunarCrush is unreachable.
2.  **`src/logic/strategy/risk_assessment.ts`**: `LOCAL_FALLBACK` returns a `HOLD` decision with 1.0 risk score if the AI/MCP engine fails outside of Sepolia.
3.  **`src/logic/agent_brain.ts`**: Deployment configuration has a hardcoded fallback to official hackathon addresses if `deployments_sepolia.json` is missing.

### Category D: Infrastructure Mocks
Files intended for testing or development environments.

1.  **`scripts/mock_kraken.sh`**: A shell-script mock of the Kraken CLI. Used by the MCP server when the real binary is unavailable.
2.  **`contracts/test/MockRegistry.sol`**: A test contract located in the `contracts/test/` subdirectory.

---

## 3. "Fail-Closed" Integrity Audit
An audit of `try/catch` blocks was performed to ensure failures lead to a HALT (Fail-Closed) rather than a mock success (Fail-Open).

- **`src/logic/agent_brain.ts`**: Verified that the hardcoded `realPrice = 67000` fallback was removed. It now throws a `CriticalSecurityException` if the price cannot be fetched.
- **`src/onchain/risk_router.ts`**: Correctly throws `CriticalSecurityException` on uninitialized addresses or signing failures.
- **`src/logic/strategy/risk_assessment.ts`**: AI failures trigger a "Degraded Mode" that relies on hardware/manual rules, but critical assessment failures throw a `CriticalSecurityException`.
- **`src/onchain/circle.ts`**: While it has a simulation bypass, its `catch` block correctly logs the error and rethrows, preventing silent failures in the "real" path.

## 4. Actionable Recommendations
1.  **Refine `circle.ts`**: Replace the `isSimulated` bypass with a strict environment check that halts if keys are missing in production.
2.  **Wire Circle WaaS Execution**: Transition the `0xCIRCLE` placeholder in `risk_router.ts` to real transaction broadcasting via the Circle SDK.
3.  **Audit `Math.random()`**: While used safely for `sessionId` in `tracker.ts`, it should be replaced with `crypto.randomUUID()` for production-grade uniqueness.
