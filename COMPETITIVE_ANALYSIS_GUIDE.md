# 🔍 MANUAL COMPETITIVE ANALYSIS GUIDE

## Objective
Analyze the top 4 agents to understand their winning strategy, then replicate/improve it.

## Top Agents to Analyze

```
Agent 1: 0x33989b6c1d9c3f3b9b3d7e8f9a0b1c2d33983570
Agent 2: 0x7a2F5c8d9e0f1a2b3c4d5e6f7a8b9c0d15e0
Agent 3: 0x0858C3285d6c9f8e7d6c5b4a3f2e1d0c9C328
Agent 4: 0xE868dCD70x95C8
```

## Step 1: View Sepolia Transactions for Each Agent

**URL:** `https://sepolia.etherscan.io/address/<AGENT_ADDRESS>`

**Instructions:**
1. Copy Agent 1 address: `0x33989b6c1d9c3f3b9b3d7e8f9a0b1c2d33983570`
2. Go to: https://sepolia.etherscan.io/address/0x33989b6c1d9c3f3b9b3d7e8f9a0b1c2d33983570
3. Look at the **Transaction List** tab
4. Record:
   - Total transactions
   - Most recent transaction date/time
   - Frequency pattern (cluster or spread?)

**What to Look For:**
- ✅ How many transactions total?
- ✅ Are they clustered (burst trading) or distributed (daily)?
- ✅ What's the time range? (hourly, daily, weekly?)

## Step 2: Analyze RiskRouter Interactions

**Instructions:**
1. On the agent's address page, click on the transactions
2. Filter or look for transactions **to** `0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC` (RiskRouter)
3. Click on each transaction to see:
   - **Input Data**: The trade parameters
   - **Gas Used**: Efficiency indicator
   - **Status**: Success (✓) or Failed (✗)

**For Each Transaction, Record:**

```markdown
| Tx Hash | Pair | Amount | Risk% | Status | Time |
|---------|------|--------|-------|--------|------|
| 0xabc... | BTC  | 10000  | 3.5   | ✓      | 12:00|
| 0xdef... | ETH  | 5000   | 4.2   | ✓      | 13:00|
```

**Key Metrics to Extract:**

```
Total Trades: ___
Successful Trades: ___
Failed Trades: ___
Success Rate: ___%

Pair Diversity (list all unique pairs):
- BTC/USDC: ___ trades
- ETH/USDC: ___ trades
- SOL/USDC: ___ trades
- Other: ___

Volume Strategy:
- Largest trade: $___
- Smallest trade: $___
- Average trade: $___
- Total volume: $___

Risk Profile:
- Highest risk: ___%
- Lowest risk: ___%
- Average risk: ___%
```

## Step 3: Timeline Analysis

**For the Top Agent, Create a Timeline:**

```
Day 1 (April 5):
  12:00 UTC - Trade 1: BTC/USDC, $10k, 3% risk → ✓
  14:30 UTC - Trade 2: ETH/USDC, $5k, 4% risk → ✓
  
Day 2 (April 6):
  09:00 UTC - Trade 3: SOL/USDC, $2k, 2% risk → ✓
  
Day 3 (April 7):
  ... (pattern continues)
```

**Analyze the Pattern:**
- Is it once per day? Multiple times per day? Random?
- Is there a time-of-day preference?
- Are there gaps? (If so, why?)

## Step 4: Pair Selection Strategy

**For Top Agent, Map Pair Frequency:**

```
Pair Distribution:
┌─────────────┬────────┬──────────┐
│ Pair        │ Count  │ % of Total│
├─────────────┼────────┼──────────┤
│ BTC/USDC    │   15   │   50%    │
│ ETH/USDC    │    8   │   27%    │
│ SOL/USDC    │    5   │   17%    │
│ Other       │    2   │    6%    │
└─────────────┴────────┴──────────┘
```

**Questions to Answer:**
- ✅ Do they focus on 1 pair or diversify?
- ✅ Is BTC/USDC the "safe" pair?
- ✅ Do they experiment with exotic pairs?

## Step 5: Volume & Risk Correlation

**Create a Scatter Analysis:**

```
Risk vs Volume (Low/Medium/High):

LOW RISK (0-2%)    | MID RISK (3-5%)    | HIGH RISK (6%+)
- Volume: $___     | - Volume: $___     | - Volume: $___
- Count: __        | - Count: __        | - Count: __

Pattern: Do they trade larger when risk is lower? Or vice versa?
```

## Step 6: Repeat for Other Agents

**Repeat Steps 1-5 for:**
- Agent 2: 0x7a2F5c8d9e0f1a2b3c4d5e6f7a8b9c0d15e0
- Agent 3: 0x0858C3285d6c9f8e7d6c5b4a3f2e1d0c9C328
- Agent 4: 0xE868dCD70x95C8

## Step 7: Comparative Analysis

**Create Comparison Table:**

```
┌─────────────┬────────┬──────────┬──────────┬──────────┐
│ Agent       │ Trades │ Vol ($K) │ Pairs    │ Success% │
├─────────────┼────────┼──────────┼──────────┼──────────┤
│ Agent 1     │   25   │   150    │    4     │  100%    │
│ Agent 2     │   12   │   200    │    2     │  100%    │
│ Agent 3     │   40   │    80    │    6     │   95%    │
│ Agent 4     │    8   │   100    │    3     │  100%    │
└─────────────┴────────┴──────────┴──────────┴──────────┘
```

**Key Insights:**
- Which wins on volume? 
- Which wins on frequency?
- Which wins on diversity?
- Which is most consistent?

## Step 8: Synthesize Winning Formula

**Based on Analysis, Fill This Template:**

```markdown
### WINNING FORMULA DISCOVERED

Frequency:    [once/day OR multiple/day OR specific pattern]
Volume:       [small=$1-5k OR medium=$5-15k OR large=$15k+]
Pairs:        [concentrated=1-2 OR balanced=3-4 OR diverse=5+]
Risk Profile: [conservative=2-3% OR moderate=4-5% OR aggressive=6%+]
Success Rate: [100% OR high OR variable]

Evidence:
- Agent X trades [frequency] and ranks highest
- Agent Y focuses on [pairs] and has best reputation
- Agent Z uses [risk profile] strategy

OPTIMAL STRATEGY FOR US:
- Trade [frequency]
- Focus on [pairs]
- Use [volume] per trade
- Maintain [risk%] risk level
- Expected outcome: [rank improvement]
```

## Your Current Agent Stats (For Reference)

```
Agent: 0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9
Trades: 1 (verified on-chain)
Volume: $10,000
Pairs: BTC/USDC
Success: 100%
Risk: 3.12%
```

## Next Steps After Analysis

1. ✅ Complete analysis of all 4 top agents
2. ✅ Fill out the "Winning Formula" template
3. ✅ Decide: Can we improve on their strategy?
4. ✅ Propose 2-3 specific improvements
5. ✅ Update agent_brain.ts with new strategy
6. ✅ Execute 3-5 test trades
7. ✅ Monitor leaderboard impact

---

**Links to Use:**

- Sepolia Etherscan: https://sepolia.etherscan.io
- RiskRouter Address: 0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC
- Your Agent: 0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9

**Estimated Time:** 15-30 minutes to analyze all 4 agents

Good luck! 🚀
