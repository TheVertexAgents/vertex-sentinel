# ERC-8004 Cleanliness Audit Report: Vertex Sentinel

**Date:** $(date)
**Auditor:** Jules (Vertex Sentinel Engineering)
**Status:** COMPLETE

---

## Executive Summary
This audit evaluated the Vertex Sentinel codebase for hardcoded data, mock logic, and placeholder integrations that might impact the agent's standing on the ERC-8004 standard. While the agent implements sophisticated EIP-712 signing and on-chain guardrails, several "strategic bypasses" and "degraded mode fallbacks" were identified that rely on hardcoded values or environment guards rather than dynamic, verifiable proofs.

**Key Stats:**
- **Total Findings:** 5
- **Critical Issues:** 3
- **Known Bypasses:** 2

---

## Methodology
The audit was performed using an automated discovery script (`scripts/audit_scan.sh`) targeting the `src/`, `scripts/`, and `contracts/` directories. Patterns searched included keywords (`mock`, `todo`, `placeholder`, `hardcoded`) and specific values known to be used in development bypasses (e.g., `67000`, `0x000...000`). Findings were manually verified for context and categorized by their impact on the ERC-8004 lifecycle.

---

## Critical Findings

### 1. Validation: Hardcoded Perfect Reputation Score
*   **File Path:** `src/onchain/validation.ts` (Line 69)
*   **Code Snippet:**
    ```typescript
    args: [agentId, checkpointHash, 100, 1, '0x', notes],
    ```
*   **Explanation:** The `postHeartbeat` function hardcodes a score of `100` and an empty proof (`0x`) when calling the `ValidationRegistry`.
*   **ERC-8004 Impact:** **High.** This bypasses the intended dynamic validation logic. It artificially inflates the agent's reputation on-chain, which triggers sybil-protection concerns and undermines the cryptographic integrity of the attestation layer.

### 2. Strategy: Hardcoded Fallback Price (PnL Distortion)
*   **File Path:** `src/logic/agent_brain.ts` (Lines 132-133)
*   **Code Snippet:**
    ```typescript
    console.warn('[AGENT_BRAIN] Failed to fetch real market price, using fallback (67000)');
    realPrice = 67000;
    ```
*   **Explanation:** If the Kraken MCP tool fails to fetch a ticker, the system defaults to a hardcoded price of $67,000 for BTC/USD.
*   **ERC-8004 Impact:** **Critical.** This invalidates PnL reporting accuracy. In a verifiable agent ecosystem, reporting a fixed price during a market crash or spike constitutes a failure of the "Truthful Reporting" principle required for accurate ROI tracking.

### 3. Identity: Zero-Address Registry Bypass
*   **File Path:** `src/onchain/identity.ts` (Lines 23-24)
*   **Code Snippet:**
    ```typescript
    if (this.registryAddress === '0x0000000000000000000000000000000000000000' || process.env.DEMO_MODE === 'true') {
      console.warn(`[identity] Skipping registration check (DEMO_MODE=true or zero address)`);
      return true;
    }
    ```
*   **Explanation:** The identity client allows bypassing the `AgentRegistry` check if the address is not configured or if a `DEMO_MODE` flag is set.
*   **ERC-8004 Impact:** **High.** ERC-8004 mandates that agent identity be cryptographically linked to an on-chain registry. Allowing "unregistered" operations (even in demo modes) creates a security hole where unauthorized actors could simulate agent behavior without valid credentials.

### 4. Strategy: Placeholder PRISM Resolution
*   **File Path:** `src/logic/agent_brain.ts` (Lines 91-95)
*   **Code Snippet:**
    ```typescript
    /**
     * @dev Mock "Strykr PRISM API" for canonical asset resolution.
     * TODO: Integrate real PRISM API (https://api.prismapi.ai/resolve)
     */
    async function getAssetResolution(pair: string) {
      console.warn('[PRISM] Using placeholder resolution - real API integration pending');
    ```
*   **Explanation:** Asset metadata resolution (essential for cross-chain verifiability) is currently a mock placeholder.
*   **ERC-8004 Impact:** **Medium.** Reduces the verifiability of the "intent" being signed. Without real PRISM resolution, the agent cannot prove it is interacting with the correct canonical asset identifiers.

---

## Impact Analysis Table

| Finding Type | Component | ERC-8004 Impact Category | Severity |
| :--- | :--- | :--- | :--- |
| **Validation** | `src/onchain` | Reputation Integrity | **CRITICAL** |
| **Strategy** | `src/logic` | PnL Verifiability | **CRITICAL** |
| **Identity** | `src/onchain` | Sybil Protection / Identity | **HIGH** |
| **Strategy** | `src/logic` | Canonical Data Verifiability | **MEDIUM** |
| **Logic** | `src/logic` | Cryptographic Proof Enforcement | **MEDIUM** |

---

## Remediation Roadmap

1.  **Phase 1 (Immediate):** Remove the hardcoded `67000` fallback. Implement a "Fail-Closed" mechanism where the agent halts if real-time pricing data is unavailable.
2.  **Phase 2 (Reputation):** Integrate a dynamic scoring engine in `validation.ts` that calculates the score based on trade accuracy and risk adherence, rather than a hardcoded `100`.
3.  **Phase 3 (Identity):** Enforce mandatory `AgentRegistry` checks. Remove the `DEMO_MODE` bypass in production paths; use a local Hardhat node for testing instead of skipping logic.
4.  **Phase 4 (Verifiability):** Complete the PRISM API integration to ensure all asset resolutions are backed by canonical metadata.

---

## Appendix: Raw Scan Logs
*The following logs contain the raw output of the `scripts/audit_scan.sh` discovery tool.*

```text
ERC-8004 Cleanliness Audit - Raw Scan Logs
Generated on: Mon Apr 13 10:45:35 UTC 2026
----------------------------------------

--- KEYWORD: mock ---
src/logic/agent_brain.ts:91: * @dev Mock "Strykr PRISM API" for canonical asset resolution.
src/logic/pnl/tracker.ts:68:      // and according to the mock in tracker.test.ts
scripts/stress_test_cycle.ts:21:    // We mock deployments for local stress test to bypass Sepolia restrictions.
scripts/verify_no_mocks.sh:3:echo '🔍 Verifying no mocks in production paths...'
scripts/verify_no_mocks.sh:7:if grep -q 'mock_kraken.sh' package.json; then
scripts/verify_no_mocks.sh:8:    echo '❌ FAIL: package.json still references mock_kraken.sh'
scripts/verify_no_mocks.sh:12:if grep -q 'mock_kraken.sh' src/logic/strategy/risk_assessment.ts; then
scripts/verify_no_mocks.sh:13:    echo '❌ FAIL: risk_assessment.ts still defaults to mock'
scripts/verify_no_mocks.sh:17:if grep -q 'const mockPrice = 67000' src/logic/agent_brain.ts; then
scripts/verify_no_mocks.sh:18:    echo '❌ FAIL: agent_brain.ts still has hardcoded mockPrice'
scripts/verify_no_mocks.sh:27:if [ -f 'contracts/MockRegistry.sol' ]; then
scripts/verify_no_mocks.sh:28:    echo '❌ FAIL: MockRegistry.sol still in production contracts directory'
scripts/verify_no_mocks.sh:33:    echo '✅ All production mock checks passed!'
scripts/audit_scan.sh:4:# Scans src/, scripts/, and contracts/ for mock patterns and hardcoded data.
scripts/audit_scan.sh:14:KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")
contracts/test/MockRegistry.sol:4:contract MockRegistry {

--- KEYWORD: placeholder ---
src/logic/agent_brain.ts:68:    riskRouter: '0x0000000000000000000000000000000000000000', // Placeholder for local
src/logic/agent_brain.ts:69:    agentRegistry: '0x0000000000000000000000000000000000000000', // Placeholder for local
src/logic/agent_brain.ts:95:  console.warn('[PRISM] Using placeholder resolution - real API integration pending');
scripts/audit_scan.sh:14:KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")

--- KEYWORD: todo ---
src/logic/agent_brain.ts:92: * TODO: Integrate real PRISM API (https://api.prismapi.ai/resolve)
scripts/audit_scan.sh:14:KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")

--- KEYWORD: hardcoded ---
scripts/verify_no_mocks.sh:18:    echo '❌ FAIL: agent_brain.ts still has hardcoded mockPrice'
scripts/audit_scan.sh:4:# Scans src/, scripts/, and contracts/ for mock patterns and hardcoded data.
scripts/audit_scan.sh:14:KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")

--- KEYWORD: fake ---
scripts/verify_no_mocks.sh:23:    echo '❌ FAIL: live_kraken_cli.js still has fake order ID generation'
scripts/audit_scan.sh:14:KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")

--- KEYWORD: fallback ---
src/logic/agent_brain.ts:132:      console.warn('[AGENT_BRAIN] Failed to fetch real market price, using fallback (67000)');
src/logic/strategy/risk_assessment.ts:155:  // Degraded Mode Fallback
src/logic/strategy/risk_assessment.ts:260:        riskScore: 0, // Fallback to solely relying on manualPenalty
src/logic/strategy/risk_assessment.ts:305:      console.warn(`[risk_assessment] Risk assessment failed in local mode, using fallback. Error: ${error instanceof Error ? error.message : String(error)}`);
src/logic/strategy/risk_assessment.ts:312:        reasoning: 'Fallback: AI/MCP Engine unavailable in local mode',
scripts/audit_scan.sh:14:KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")

--- PATTERN: 0x0000000000000000000000000000000000000000 ---
src/logic/agent_brain.ts:68:    riskRouter: '0x0000000000000000000000000000000000000000', // Placeholder for local
src/logic/agent_brain.ts:69:    agentRegistry: '0x0000000000000000000000000000000000000000', // Placeholder for local
src/logic/agent_brain.ts:70:    validationRegistry: '0x0000000000000000000000000000000000000000',
src/logic/agent_brain.ts:71:    reputationRegistry: '0x0000000000000000000000000000000000000000'
src/onchain/identity.ts:23:    if (this.registryAddress === '0x0000000000000000000000000000000000000000' || process.env.DEMO_MODE === 'true') {
src/onchain/risk_router.ts:55:    if (this.routerAddress === '0x0000000000000000000000000000000000000000') {
src/onchain/risk_router.ts:150:    if (this.routerAddress === '0x0000000000000000000000000000000000000000' || process.env.DEMO_MODE === 'true') {
src/onchain/validation.ts:31:    if (this.registryAddress === '0x0000000000000000000000000000000000000000') {
src/onchain/reputation.ts:31:    if (this.registryAddress === '0x0000000000000000000000000000000000000000') {
src/execution/proxy.ts:58:      this.contractAddress = contractAddress || '0x0000000000000000000000000000000000000000';
scripts/stress_test_cycle.ts:28:    const proxy = new ExecutionProxy('0x0000000000000000000000000000000000000000', 'local');
scripts/audit_scan.sh:15:SPECIAL_PATTERNS=("0x0000000000000000000000000000000000000000" "100" "67000" "DEMO_MODE" "NETWORK !== 'sepolia'")

--- PATTERN: 100 ---
src/logic/agent_brain.ts:141:      amount: Number(intent.amountUsdScaled) / 100 / realPrice,
src/logic/agent_brain.ts:151:    // Strategic: Always post 100 to counteract competitor zero-scores.
src/logic/agent_brain.ts:278:  console.log(`  Trading Interval: ${TRADING_INTERVAL_MS / 1000}s`);
src/logic/agent_brain.ts:300:        maxSlippageBps: 100n,
src/logic/agent_brain.ts:302:        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
src/logic/agent_brain.ts:325:    console.log(`\n⏳ Next trade in ${TRADING_INTERVAL_MS / 1000} seconds...`);
src/logic/strategy/risk_assessment.ts:188:    const volumePenalty = Math.min(0.2, (Number(amountUsdScaled) / 100000) * 0.2);
src/logic/strategy/risk_assessment.ts:192:    const amountUsd = Number(amountUsdScaled) / 100;
src/logic/strategy/risk_assessment.ts:249:          await new Promise(r => setTimeout(r, attempts * 1000));
src/logic/strategy/risk_assessment.ts:277:    if (manualPenalty > 0.8) reasons.push(`Critical Manual Penalty: ${(manualPenalty * 100).toFixed(0)}%`);
src/logic/strategy/risk_assessment.ts:278:    if (aiResult.riskScore > 0.8) reasons.push(`Critical AI Risk Score: ${(aiResult.riskScore * 100).toFixed(0)}%`);
src/logic/pnl/calculator.ts:15:    const buyFee = buyValue * (feePercent / 100);
src/logic/pnl/calculator.ts:16:    const sellFee = sellValue * (feePercent / 100);
src/logic/pnl/calculator.ts:33:    return (netPnL / invested) * 100;
src/logic/pnl/calculator.ts:42:    return (wins / results.length) * 100;
src/logic/pnl/tracker.ts:25:    const fee = (trade.price * trade.amount) * (feePercent / 100);
src/utils/checkpoint.ts:55:      const timestamp = BigInt(Math.floor(Date.now() / 1000));
src/utils/checkpoint.ts:72:      confidenceScaled: BigInt(Math.round(decision.confidence * 1000)),
src/utils/explainability.ts:11:  const amountStr = (Number(decision.amountUsdScaled) / 100).toLocaleString('en-US', {
src/utils/explainability.ts:16:  const confidencePct = (decision.confidence * 100).toFixed(0);
src/utils/explainability.ts:17:  const riskScore = (decision.riskScore * 100).toFixed(0);
src/utils/explainability.ts:20:  const breakdownStr = `Market: ${(b.marketRisk * 100).toFixed(0)}% | Portfolio: ${(b.portfolioRisk * 100).toFixed(0)}% | Sentiment: ${(b.sentimentRisk * 100).toFixed(0)}% | AI-Score: ${(b.aiScore * 100).toFixed(0)}% | Bootstrap: ${(b.manualPenalty * 100).toFixed(0)}%`;
src/utils/explainability.ts:33:    `  ${decision.marketData ? `Market Context:   Spread=${(decision.marketData.spread * 100).toFixed(4)}% | Volatility=${(decision.marketData.volatility * 100).toFixed(2)}%` : ''}`
src/mcp/kraken/index.ts:313:                  time: typeof t.time === 'string' ? new Date(t.time as string).getTime() / 1000 : t.time,
src/mcp/kraken/types.ts:25: * Live format:  {"ZUSD": "1000.00", "XXBT": "0.01"}
src/onchain/validation.ts:69:        args: [agentId, checkpointHash, 100, 1, '0x', notes],
scripts/demo_flow.ts:27:    console.log(`[KRAKEN]   Amount : $${(Number(amountUsdScaled) / 100).toFixed(2)}`);
scripts/demo_flow.ts:77:    1000000n,          // maxPositionUsdScaled ($10,000)
scripts/demo_flow.ts:79:    100n               // maxTradesPerHour
scripts/demo_flow.ts:81:  console.log(`  ✅ Risk params set: maxPosition=$10,000, maxDrawdown=5%, maxTrades=100/hr`);
scripts/demo_flow.ts:106:  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
scripts/demo_flow.ts:112:    amountUsdScaled: 10000n, // $100.00
scripts/demo_flow.ts:113:    maxSlippageBps: 100n, // 1%
scripts/mock_kraken.sh:13:        "v": ["100", "200"],
scripts/mock_kraken.sh:24:        "v": ["100", "200"],
scripts/mock_kraken.sh:35:      "ZUSD": "100000.00",
scripts/mock_kraken.sh:60:          "price": "51000.0",
scripts/mock_kraken.sh:61:          "cost": "5100.0",
scripts/mock_kraken.sh:73:        "order": "buy 0.10000000 XBTUSD @ market"
scripts/stress_test_cycle.ts:42:    const volumeUsdScaled = 1000n; // ~ $10.00 each
scripts/stress_test_cycle.ts:53:    console.log(`\\n[+] Analysis Phase Complete in ${((endAnalysis - startAnalysis)/1000).toFixed(2)}s`);
scripts/stress_test_cycle.ts:83:    console.log(`\\n[+] Execution Phase Complete in ${((endExecution - startExecution)/1000).toFixed(2)}s\\n`);
scripts/execute_live_trades_with_pnl.ts:45:        { pair: 'BTC/USD', amount: 0.00015, usdValue: 10030, side: 'BUY' },
scripts/execute_live_trades_with_pnl.ts:46:        { pair: 'BTC/USD', amount: 0.00015, usdValue: 10030, side: 'SELL' },
scripts/hackathon_submit.ts:118:            amountUsdScaled: 10000n, // $100.00 (under 500 cap)
scripts/hackathon_submit.ts:119:            maxSlippageBps: 100n,
scripts/hackathon_submit.ts:121:            deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hr deadline
scripts/hackathon_submit.ts:157:            args: [agentId, checkpointHash, 100, 1, '0x', "Hackathon submission"]
scripts/execute_live_trades.ts:34:        { pair: 'BTC/USD', amount: 0.00015, usdValue: 10030n },
scripts/audit_scan.sh:15:SPECIAL_PATTERNS=("0x0000000000000000000000000000000000000000" "100" "67000" "DEMO_MODE" "NETWORK !== 'sepolia'")
scripts/verify-production-ready.sh:262:SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TOTAL_CHECKS ))
scripts/verify-production-ready.sh:350:✅ **8/8 verification checks passed (100%)**
contracts/ValidationRegistry.sol:41:        uint8    score;            // 0–100 validation quality score
contracts/ValidationRegistry.sol:126:     * @param score           Quality score 0–100.
contracts/ValidationRegistry.sol:141:        require(score <= 100, "ValidationRegistry: score must be 0-100");
contracts/RiskRouter.sol:140:            if (amountUsdScaled > 100000) return (false, "No risk params: exceeds 000 default cap");
contracts/ReputationRegistry.sol:30:        uint8   score;        // 1–100
contracts/ReputationRegistry.sol:88:     * @param score        Score 1–100 (100 = best).
contracts/ReputationRegistry.sol:102:        require(score >= 1 && score <= 100, "ReputationRegistry: score must be 1-100");

--- PATTERN: 67000 ---
src/logic/agent_brain.ts:132:      console.warn('[AGENT_BRAIN] Failed to fetch real market price, using fallback (67000)');
src/logic/agent_brain.ts:133:      realPrice = 67000;
scripts/verify_no_mocks.sh:17:if grep -q 'const mockPrice = 67000' src/logic/agent_brain.ts; then
scripts/audit_scan.sh:15:SPECIAL_PATTERNS=("0x0000000000000000000000000000000000000000" "100" "67000" "DEMO_MODE" "NETWORK !== 'sepolia'")

--- PATTERN: DEMO_MODE ---
src/onchain/identity.ts:23:    if (this.registryAddress === '0x0000000000000000000000000000000000000000' || process.env.DEMO_MODE === 'true') {
src/onchain/identity.ts:24:      console.warn(`[identity] Skipping registration check (DEMO_MODE=true or zero address)`);
src/onchain/risk_router.ts:150:    if (this.routerAddress === '0x0000000000000000000000000000000000000000' || process.env.DEMO_MODE === 'true') {
src/onchain/risk_router.ts:151:        console.warn(`[RiskRouterClient] Skipping on-chain submission (DEMO_MODE=true or zero address)`);
scripts/audit_scan.sh:15:SPECIAL_PATTERNS=("0x0000000000000000000000000000000000000000" "100" "67000" "DEMO_MODE" "NETWORK !== 'sepolia'")

--- PATTERN: NETWORK !== 'sepolia' ---
src/logic/strategy/risk_assessment.ts:304:    if (process.env.NETWORK !== 'sepolia') {
scripts/audit_scan.sh:15:SPECIAL_PATTERNS=("0x0000000000000000000000000000000000000000" "100" "67000" "DEMO_MODE" "NETWORK !== 'sepolia'")
```
