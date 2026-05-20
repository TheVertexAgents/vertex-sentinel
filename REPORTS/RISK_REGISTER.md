# Risk Register - Vertex Sentinel

This document identifies the top 10 risks for the Vertex Sentinel project, categorized by impact and probability.

| Risk ID | Description | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| R-01 | **Private Key Exposure** - Leaking `AGENT_PRIVATE_KEY` or `KRAKEN_SECRET` would allow unauthorized fund movement or trade execution. | Critical | Low | Use environment variables, never commit `.env`, consider hardware security modules or Circle WaaS for production. |
| R-02 | **AI Hallucination/Logic Error** - AI risk assessment provides incorrect high confidence for a high-risk trade. | High | Medium | Dual-layer validation (Genkit + hardcoded guardrails), circuit breakers, and mandatory EIP-712 signing of specific intents. |
| R-03 | **Oracle/Data Feed Failure** - Inaccurate market data leads to incorrect risk scoring or trade execution. | High | Medium | Multi-source data validation (LunarCrush, CoinGecko, Strykr PRISM) and sanity checks on price volatility. |
| R-04 | **Smart Contract Vulnerability** - Bugs in `RiskRouter.sol` could bypass guardrails or freeze funds. | Critical | Low | Extensive unit testing, professional audits, and bug bounty programs. |
| R-05 | **Dependency Vulnerability** - Critical vulnerabilities in upstream packages (e.g., `ethers`, `express`). | Medium | Medium | Regular `npm audit`, use of lockfiles, and dependency pinning. |
| R-06 | **API Rate Limiting** - Being throttled by Kraken, Groq, or Infura APIs during high volatility. | Medium | High | Implement robust retry logic with exponential backoff and multi-provider failover. |
| R-07 | **Fail-Closed Malfunction** - System fails to halt during a critical error, leading to unintended trades. | Critical | Low | "Heartbeat" mechanism, rigorous integration testing of the `HALTED` state logic. |
| R-08 | **Regulatory Compliance** - Changes in DeFi/AI regulations affecting the "verifiable risk" model. | Medium | Low | Maintain transparent audit logs (EIP-712) and Industry 5.0 (ESG) compliance features. |
| R-09 | **Network Congestion (L1/L2)** - High gas fees or slow confirmation times on Sepolia/Mainnet impacting guardrail updates. | Medium | Medium | Optimization of contract calls, monitoring of gas prices, and using fast-finality L2s. |
| R-10 | **Infrastructure Downtime** - Server hosting the Sentinel agent goes offline. | Medium | Medium | Multi-region deployment, automated health checks, and alerting (Telegram/SendGrid). |
