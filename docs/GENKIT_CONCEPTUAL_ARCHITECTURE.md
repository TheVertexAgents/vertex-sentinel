# Genkit Conceptual Architecture & Documentation Summary

Based on the **Vertex Sentinel** documentation (Whitepaper, Roadmap, and Research logs), Genkit is intended to serve as the "Intelligent Risk Engine."

## 1. Documented Purpose of Genkit
According to the documentation, Genkit is responsible for the **Genkit Risk Assessment Flow**. Its purpose is to bridge the "Hallucination-to-Liquidation Gap" by providing a verifiable, AI-powered security check before any trade is signed.

### Core Responsibilities:
- **Multi-Dimensional Risk Scoring**: Evaluation of trades based on:
    - **Market Conditions**: Volatility, liquidity, and bid/ask spread.
    - **Portfolio Impact**: Sizing of the trade relative to the agent's total allocation.
    - **Historical Performance**: Correlation with past successful or failed strategies.
    - **Sentiment Analysis**: Real-time news and social indicators.
- **Explainability**: Generating human-readable "Reasoning" artifacts that are cryptographically hashed and included in the audit trail.
- **Fail-Closed Enforcement**: If the Genkit flow returns a score above **0.8**, the system is documented to immediately halt and reject the intent.

## 2. Documented System Prompt (Conceptual)
While the current code uses Genkit purely for schema validation, the documentation defines the "Specialist" persona that the Genkit flow is intended to adopt.

**Conceptual System Prompt:**
> "You are the Vertex Sentinel Risk Specialist. Your mandate is to protect the agent's capital by identifying high-risk trade intents before they reach the blockchain. Analyze the provided Market Ticker data and Trade Intent. Evaluate the Bid/Ask spread, 24h volatility, and position size. Output a Risk Score between 0.0 (Safe) and 1.0 (Critical) and a concise, human-readable justification for your score. Prioritize capital preservation over alpha generation."

## 3. Current Implementation Status vs. Documentation
- **Implemented**: Use of `genkit/z` for schema definition and type safety in `src/logic/strategy/risk_assessment.ts`.
- **Implemented**: A "Bootstrap" Dynamic Penalty Model (manual math) that mimics the documented scoring logic.
- **Pending (Roadmap Milestone 2)**: Integration of `ai.generate()` with a Google Gemini model and the formal System Prompt described above.

## 4. Key References
- **WHITEPAPER.md**: Section 5.1.2 "Genkit Risk Assessment Flow"
- **RESEARCH_SDK_INTEGRATION.md**: Section 3 "Genkit Modular Risk Engine"
- **ROADMAP.md**: Milestone 2 "Intelligent Verifiability"
