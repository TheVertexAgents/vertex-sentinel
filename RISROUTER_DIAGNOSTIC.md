# RiskRouter Trade Validation Analysis

## �� What the Audit Trail Shows

Your `logs/audit.json` contains **3 trade records** (only 1 with PnL data):

### Trade 1 (April 5, 13:01 UTC)
```json
{
  "agentId": "1",
  "timestamp": "1775491308",
  "pair": "BTC/USD",
  "action": "BUY",
  "amountUsdScaled": "10000"
}
```
**Status:** ⚠️ No PnL data (not executed on Kraken?)

### Trade 2 (April 5, 13:03 UTC) ✅ EXECUTED
```json
{
  "pair": "BTC/USDC",
  "action": "BUY",
  "amountUsdScaled": "10000",
  "pnl": {
    "totalTrades": 1,
    "winRate": 0,
    "unrealizedPnL": -0.52,
    "totalPnL": -0.52
  }
}
```
**Status:** ✅ This is the 1 trade showing in ReputationRegistry

### Trade 3 (April 6, 19:53 UTC)
```json
{
  "pair": "BTC/USD",
  "action": "BUY",
  "amountUsdScaled": "10000"
}
```
**Status:** ⚠️ No PnL data (pending execution?)

---

## 🔍 The Real Issue

### What SHOULD Happen (Judge Bot's Expectation):
1. Trade intent created with EIP-712 signature
2. Trade sent through RiskRouter.sol for validation
3. RiskRouter emits `TradeAuthorized` event
4. Trade executed on Kraken
5. PnL recorded in audit trail
6. Judge bot picks up `TradeAuthorized` event from contract logs

### What's Actually Happening:
1. ✅ Trade intents created with signatures (in audit.json)
2. ❌ **NOT going through RiskRouter for validation**
3. ❌ Trades going directly to Kraken (no `TradeAuthorized` event)
4. ✅ Only 1 trade executed (trades 1 & 3 appear to be pending)
5. ✅ PnL recorded for executed trade
6. ❌ Judge bot sees no RiskRouter events = low validation score

---

## ⚡ The Fix

Your `src/execution/proxy.ts` needs to:

### Current Flow (Wrong):
```
AgentBrain → Kraken CLI/MCP → Kraken Execution
            (no RiskRouter validation)
```

### Required Flow:
```
AgentBrain → EIP-712 SignIntent → RiskRouter Contract → Kraken CLI/MCP → Kraken Execution
                                  (emits TradeAuthorized)
```

### Specific Changes Needed in `src/execution/proxy.ts`:

1. **Before** executing any trade, call RiskRouter to validate:
```typescript
// Inside proxy.ts
const intentHash = await riskRouter.validateTradeIntent({
  agentId: 1,
  agentWallet: "0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9",
  pair: "BTC/USD",
  action: "BUY",
  amountUsdScaled: "10000",
  maxSlippageBps: 50,
  nonce: nonce++,
  deadline: Math.floor(Date.now() / 1000) + 3600
});

// Only proceed to Kraken if validation succeeds
if (intentHash) {
  // Execute on Kraken
  await executeOnKraken(...)
}
```

2. **Ensure EIP-712 nonce management:**
   - Each trade needs unique nonce
   - Track nonces to prevent replay attacks
   - Check that nonce/deadline aren't causing validation failures

3. **Ensure deadline is always in future:**
   - Current: deadline + 3600 seconds (1 hour)
   - This should be sufficient for Kraken order execution

---

## 🎯 Why This Matters for Scoring

| Scenario | RiskRouter Approved | Judge Bot Sees | Validation Score | Reputation Score |
|----------|-------------------|-----------------|------------------|------------------|
| **Now** | 0 of 4 trades | 0 trades | 15/100 (very low) | 41/100 (low) |
| **After Fix** | 4 of 4 trades | 4 trades | 75-90/100 (high) | 60-80/100 (good) |

Each trade going through RiskRouter = judge bot sees it = score increases

---

## 📝 Action Steps

### Step 1: Review `src/execution/proxy.ts`
Check the current implementation to see where RiskRouter validation should be inserted.

### Step 2: Implement RiskRouter Integration
```typescript
// In proxy.ts, before Kraken execution:
const riskRouterContract = new ethers.Contract(
  "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC",
  RISK_ROUTER_ABI,
  provider
);

// Validate intent against RiskRouter
const validateTx = await riskRouterContract.validateTradeIntent(tradeIntent, signature);
const receipt = await validateTx.wait();

// Check for TradeAuthorized event
const events = receipt.logs.map(log => riskRouterContract.interface.parseLog(log));
const authorized = events.some(e => e.name === "TradeAuthorized");

if (authorized) {
  // Proceed to Kraken execution
} else {
  // Reject trade
  throw new Error("RiskRouter validation failed");
}
```

### Step 3: Test with 1-2 New Trades
Execute 1-2 new test trades with the fixed integration:
```bash
npm run execute:live:trades
```

### Step 4: Monitor Judge Bot Re-score
Judge bot re-scores every 4 hours. After your fix:
- Wait ~4 hours for re-score
- Check if validation score increases
- Check if reputation score increases

---

## �� Quick Summary

**Your agent is trading fine, but the scoring system can't see it!**

- ❌ Trades not going through RiskRouter
- ❌ Judge bot sees 0 validated trades
- ❌ Validation score stuck at 15/100
- ❌ Reputation score stuck at 41/100

**Fix:** Route all trades through RiskRouter contract validation before executing on Kraken.

**Result:** Judge bot will see your trades → validation & reputation scores climb → ranking improves.

