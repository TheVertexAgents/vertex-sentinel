# 🚀 RiskRouter Integration - Execution Guide

**Created:** April 8, 2026  
**Status:** Code is ready to test  
**Estimated Time to First Result:** 5-10 minutes  

---

## 🎯 What You Have Now

✅ **RiskRouter validation layer** - Integrated into agent_brain.ts  
✅ **EIP-712 signing** - Already implemented (unchanged)  
✅ **Trade authorization** - New on-chain flow via RiskRouter  
✅ **Error handling** - Graceful fallbacks for network failures  
✅ **Comprehensive logging** - Track each step of the validation  

---

## 📋 The 5-Step Process

### Step 1: Verify Your .env Has Required Variables

```bash
# Check that .env has these (needed for RiskRouter submission):
cat .env | grep -E "AGENT_PRIVATE_KEY|NETWORK|INFURA_KEY"
```

**Expected Output:**
```
AGENT_PRIVATE_KEY=0x...your_key...
NETWORK=sepolia
INFURA_KEY=...your_infura_key...
```

**If missing:**
```bash
# Add to .env:
echo "NETWORK=sepolia" >> .env
echo "INFURA_KEY=your_infura_project_id" >> .env
```

---

### Step 2: Run Your First RiskRouter-Validated Trade

```bash
# This will:
# 1. Analyze risk (BTC/USDC pair)
# 2. Sign intent with EIP-712
# 3. [NEW] Submit to RiskRouter contract
# 4. [NEW] Wait for TradeAuthorized event
# 5. Output the signed authorization

npm run start
```

**What to expect in the output:**

```json
{
  "level": "INFO",
  "step": "SUBMITTING_TO_RISKROUTER",
  "contractAddress": "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC",
  "TRACE_ID": "abc123..."
}

{
  "level": "INFO",
  "step": "WAITING_FOR_RISKROUTER_CONFIRMATION",
  "txHash": "0x7f8c9d...",
  "TRACE_ID": "abc123..."
}

{
  "level": "INFO",
  "step": "RISKROUTER_AUTHORIZED",
  "txHash": "0x7f8c9d...",
  "pair": "BTC/USDC",
  "amount": "10000"
}

--- AUTHORIZATION ARTIFACT ---
{
  "isAllowed": true,
  "reason": "...",
  "signature": "0x..."
}
```

**Success Indicators:**
- ✅ No errors in output
- ✅ You see `RISKROUTER_AUTHORIZED` message
- ✅ You see the authorization artifact at the end

**Troubleshooting:**
- If you see `RISKROUTER_AUTHORIZATION_FAILED`: Network issue or RiskRouter revert
  - Check Sepolia is working: `curl https://sepolia.infura.io/v3/YOUR_KEY`
  - Check agent is registered: Run `npm run onboard:sepolia` again
- If timeout: Take up to 30 seconds, check Etherscan

---

### Step 3: Verify the Transaction on Etherscan

After seeing `RISKROUTER_AUTHORIZED` with a transaction hash:

1. Go to: **https://sepolia.etherscan.io/tx/0x7f8c9d...**
   (Replace with your actual tx hash)

2. Look for these indicators:
   - Status: ✅ Success (green)
   - To: `0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC` (RiskRouter)
   - Function: `authorizeTrade`

3. Under "Logs" tab, look for:
   - **TradeAuthorized** event with your agent address

---

### Step 4: (Optional) Execute Live Trade on Kraken

If you want to actually execute on Kraken after authorization:

```bash
# This uses your authorized signature from step 2
npm run execute:live:trades
```

This will:
1. Use the authorized signature
2. Place order on Kraken via MCP
3. Record in audit trail

---

### Step 5: Wait for Judge Bot Re-score (~4 hours)

Judge bot automatically runs every 4 hours:

```
April 8, 14:46 UTC - You run the new code
April 8, 16:00 UTC - First judge bot run
April 8, 18:00 UTC - Second judge bot run
April 8, 20:00 UTC - Third judge bot run (should see your trades now)
```

**After re-score, check:**
- Validation score (should be 75-90/100, up from 15/100)
- Reputation score (should be 55-70/100, up from 41/100)
- Your ranking (should improve toward top 20)

---

## 🔍 How to Verify Everything is Working

### Method 1: Check RiskRouter Events Directly

```bash
# See all TradeAuthorized events for your agent:
curl "https://sepolia.infura.io/v3/YOUR_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getLogs",
    "params": [{
      "address": "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC",
      "topics": [
        "0x...TradeAuthorized_signature...",
        null,
        "0x0000000000000000000000005367F88E7B24bFa34A453CF24f7BE741CF3276c9"
      ]
    }],
    "id": 1
  }'
```

### Method 2: Visual Check on Etherscan

https://sepolia.etherscan.io/address/0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC#events

Filter by:
- Event: `TradeAuthorized`
- Agent: `0x5367...76c9`

Should see events timestamped today (April 8, 2026).

---

## 📊 What Changes in Each Component

### agent_brain.ts
**Before:**
```
1. Analyze risk
2. Sign intent (EIP-712)
3. Return authorization
```

**After:**
```
1. Analyze risk
2. Sign intent (EIP-712)
3. Submit to RiskRouter ← NEW
4. Wait for confirmation ← NEW
5. Return authorization
```

### RiskRouterClient
**Before:**
```
- signIntent() only
```

**After:**
```
- signIntent() [unchanged]
- authorizeTrade() [NEW]
- waitForTradeAuthorization() [NEW]
```

### ExecutionProxy
**No changes required** - Already listening for TradeAuthorized events!

---

## 🛡️ Error Scenarios & Handling

### Scenario 1: RiskRouter says "Circuit Breaker"
```
Level: ERROR
Step: RISKROUTER_AUTHORIZATION_FAILED
Error: "Circuit Breaker: Amount Exceeded"
```
**Fix:** Amount (10000 USD) is under the limit (100k), but if you see this, contact hackathon support.

### Scenario 2: Agent not registered
```
Level: CRITICAL
Exception: "Agent 0x5367...76c9 is not registered in AgentRegistry"
```
**Fix:** Run `npm run onboard:sepolia` to register agent first.

### Scenario 3: Network timeout
```
Level: ERROR
Step: WAITING_FOR_RISKROUTER_CONFIRMATION
Reason: "Timeout waiting for transaction receipt"
```
**Fix:** Sepolia might be congested. Wait 30 seconds and try again.

---

## ⏱️ Timeline for Full Success

| Time | Action | Result |
|------|--------|--------|
| Now | Run `npm run start` | RiskRouter trades authorized |
| +1-2 min | Check Etherscan | See TradeAuthorized event |
| +10 min | (Optional) `npm run execute:live:trades` | Order on Kraken |
| +4 hours | Judge bot re-scores | Validation ↑ Reputation ↑ |
| +4+ hours | Check leaderboard | Ranking improves |

---

## 🎯 Success Criteria

You'll know it's working when:

- [ ] `npm run start` completes without errors
- [ ] Output shows `RISKROUTER_AUTHORIZED` message
- [ ] Transaction hash is visible on Sepolia Etherscan
- [ ] Etherscan shows `TradeAuthorized` event
- [ ] Judge bot re-score shows validation score increased
- [ ] Your ranking climbs

---

## 📞 If Something Goes Wrong

1. **Check the logs carefully** - JSON format tells you exactly what failed
2. **Search GitHub issues** - #71, #61, #62 might have your error
3. **Verify .env has NETWORK=sepolia** - Easy to miss!
4. **Check INFURA_KEY is valid** - Test with curl
5. **Ensure AGENT_PRIVATE_KEY is correct** - Should match wallet address

---

## 🚀 You're Ready!

The code is implemented and ready to test. The next big step is:

```bash
npm run start
```

This single command will:
1. Run your agent brain
2. Trigger RiskRouter integration
3. Emit TradeAuthorized event on-chain
4. Create evidence for judge bot
5. Start your climb up the leaderboard

**Let's go! 🎉**

