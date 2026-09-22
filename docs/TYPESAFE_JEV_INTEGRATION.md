# TypeSafe AI — Jev Model Integration Research

> **Date:** 2026-09-22
> **Source:** https://docs.typesafe.ai/
> **Status:** Research / Architecture reference — not yet implemented

---

## What is Jev?

**Jev** is TypeSafe AI's flagship "System One" model. It is **NOT** a text-generation LLM (does not write code, hold conversations, or generate prose). It is a **decision model** built for AI-powered software:

> *Send state + typed questions → get structured answers your code can use directly.*

### Core Primitives

| Primitive | Goal | Returns |
|-----------|------|---------|
| **Choice** | Select one option from a defined set | `choice`, `probabilities`, `confidence` |
| **Score** | Rate content against ordered, descriptive levels | `score`, `probabilities`, `confidence` |
| **Noul** | Evaluate a yes/no statement | `noul` (0–1 probability) |

### Key Properties

- **Type-safe by construction** — outputs conform to JSON schema, never invents values outside defined options
- **Parallel evaluation** — all questions evaluated independently in one request (~100ms)
- **Calibrated confidence** — RLC-trained to communicate uncertainty honestly, not overconfidently
- **Self-consistent** — stable answers across repeated evaluations
- **100x cheaper** than frontier LLMs — designed for high-volume, real-time decision paths
- **Structured state** — send nested JSON, reference specific paths with backtick notation

---

## Why Jev for Vertex Sentinel?

Vertex Sentinel is the **fail-closed execution layer for autonomous AI trading agents**. Jev's strengths map directly to the risk-critical, real-time decision requirements of trading:

### 1. Natural-Language Trading Interface

Map user intent → typed function calls with calibrated confidence:

```
"plot rolling correlation between nvda and spy for the past month"
    → rolling_correlation(symbol='NVDA', benchmark='SPY', window='1mo')  confidence 0.91
```

**Application for Sentinel:**
- User types trading intent in the institutional dashboard (port 3005)
- Jev decomposes into `Choice` questions over closed-set arguments (tickers, timeframes, chart types)
- Confidence gates: auto-execute high-confidence, review medium-confidence, block low-confidence

### 2. Trade Signal Verification

Decompose trading signals into atomic Noul questions evaluated in parallel:

```python
state = {
    "signal": {"type": "RSI_divergence", "timeframe": "4H", "asset": "BTC/USDT"},
    "market": {"rsi": 72, "volume_profile": "declining", "trend": "bullish"},
    "risk": {"current_exposure": 0.15, "max_position": 0.10}
}

questions = {
    "is_reliable_signal": Noul("Does the RSI divergence on 4H indicate a reliable reversal?"),
    "volume_confirms": Noul("Does volume confirm the signal direction?"),
    "within_risk_limits": Noul("Is the proposed position within risk limits?"),
    "market_regime_allows": Noul("Does the current market regime allow counter-trend entries?")
}
```

Combine in code:
```python
signal_strength = (
    0.35 * answers["is_reliable_signal"].noul +
    0.25 * answers["volume_confirms"].noul +
    0.25 * answers["within_risk_limits"].noul +
    0.15 * answers["market_regime_allows"].noul
)

if signal_strength > 0.8 and answers["is_reliable_signal"].confidence > 0.7:
    execute_trade(proposed_trade)
elif signal_strength > 0.5:
    queue_for_human_review(proposed_trade)
else:
    reject_trade("Signal below threshold")
```

### 3. Market Regime Classification

```python
questions = {
    "regime": Choice(
        instructions="What is the current market regime?",
        criteria={
            "risk_off": {"what": "Flight to safety, rising volatility, falling risk assets"},
            "risk_on": {"what": "Expanding risk appetite, stable volatility, rising equities"},
            "volatile": {"what": "High volatility without clear directional conviction"},
            "stable": {"what": "Low volatility, range-bound markets"}
        }
    ),
    "trend_strength": Score(
        instructions="Rate the strength of the current trend",
        levels=["weak", "moderate", "strong", "parabolic"]
    )
}
```

Route trading strategies based on `regime.choice` + `regime.confidence`.

### 4. Risk Scoring (Score Primitive)

```python
questions = {
    "trade_risk": Score(
        instructions="Rate the risk of this trade setup",
        levels=["minimal", "low", "moderate", "high", "extreme"]
    ),
    "liquidity_risk": Noul("Is there sufficient liquidity to exit this position?"),
    "correlation_risk": Noul("Does this trade concentrate correlated risk?")
}
```

Automatic position sizing based on `trade_risk.score`:
- minimal/low → full size
- moderate → 50% size
- high → 25% size + mandatory stop-loss
- extreme → reject

### 5. Real-Time Trade Guardrails

Screen every trade request before execution — fits Sentinel's fail-closed architecture:

```python
state = {
    "proposed_trade": {...},
    "portfolio": {...},
    "circuit_breakers": {"max_daily_loss": -0.05, "max_single_position": 0.15}
}

questions = {
    "within_circuit_breakers": Noul("Does this trade violate any circuit breaker limits?"),
    "not_manipulated": Noul("Is the market showing signs of manipulation or anomalous order flow?"),
    "intent_matches_strategy": Noul("Does this trade align with the agent's declared strategy?")
}

# Fail-closed: any Noul below threshold triggers HALT
for q_name, answer in answers.items():
    if answer.noul < 0.5:
        raise CriticalSecurityException(f"Guardrail failed: {q_name} (noul={answer.noul})")
```

### 6. Confidence-Gated Routing Architecture

The defining pattern for Sentinel:

```
Jev Answer
    │
    ├── confidence >= 0.85 → AUTO-EXECUTE (code path)
    │
    ├── 0.60 <= confidence < 0.85 → QUEUE FOR REVIEW (human-in-loop)
    │
    ├── confidence < 0.60 → REJECT + LOG (fail-closed)
    │
    └── uncertainty in critical dimension → ESCALATE to reasoning model
```

This aligns with Sentinel's existing `CriticalSecurityException` pattern — low confidence = HALT.

---

## Integration Architecture

### Within Sentinel's Codebase

```
src/
├── services/
│   └── typesafe/           # NEW: TypeSafe integration layer
│       ├── client.ts       # Jev SDK wrapper
│       ├── questions.ts    # Question templates for trading decisions
│       ├── routing.ts      # Confidence-gated routing logic
│       └── types.ts        # Type definitions for questions/answers
```

### Within Hermes Sentinel Profile

The sentinel profile already uses Hermes Agent. Integration points:

1. **Jev as a decision tool** — sentinel profile calls Jev as a typed function for trading decisions
2. **Decomposed prompts** — instead of one broad LLM prompt ("should I trade?"), many atomic Jev questions evaluated in parallel
3. **Confidence-driven workflow** — Hermes Agent routes based on Jev confidence: auto-proceed, escalate, or halt

### Confidence vs. Probability (Important Distinction)

- **Probability** — likelihood of each option being correct (sums to 1.0)
- **Confidence** — model's certainty that its top answer is right (independent axis)
- Use **confidence** for routing decisions (act vs. escalate)
- Use **probabilities** for weighted composition (risk scoring)

---

## Design Principles (from TypeSafe Docs)

1. **Keep code in control** — code owns control flow, Jev handles narrow semantic decisions
2. **Decompose questions** — one judgment per question, combine in code with explicit weights
3. **Send minimal state** — only include context relevant to current questions (avoids context rot)
4. **Use structure in questions** — nested JSON, backtick path references for precision
5. **Many questions per request** — questions run in parallel, cost doesn't scale linearly
6. **Confidence gates, not thresholds** — don't fit thresholds blindly; plot confidence vs. accuracy on your data

---

## Next Steps (When Ready to Implement)

1. Sign up at https://console.typesafe.ai/ for API key
2. `pip install typesafe-sdk` (Python) or npm install (JS)
3. Set `TYPESAFE_API_KEY` in `.env`
4. Build `src/services/typesafe/client.ts` wrapper
5. Define question templates for Sentinel's core decisions (signal verification, risk scoring, regime classification)
6. Integrate into existing `agent_brain.ts` or strategy assessment flow
7. Add confidence-gated routing to execution pipeline
8. Test in simulation before connecting to live execution

---

## References

- **Docs:** https://docs.typesafe.ai/
- **Function Calling Cookbook:** https://docs.typesafe.ai/cookbooks/function_calling
- **How to Build with TypeSafe:** https://docs.typesafe.ai/concepts/how-to-build-with-system-one
- **Confidence Routing Pattern:** https://docs.typesafe.ai/patterns/confidence-routing
- **Composite Scoring Pattern:** https://docs.typesafe.ai/patterns/composite-scoring
- **LLM Guardrails Cookbook:** https://docs.typesafe.ai/cookbooks/llm_guardrails
