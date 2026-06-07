# Vertex Sentinel Changelog

## [v1.4.0] - 2026-06-30
### Added
- **Extreme Market Stress Test Suite:** Automated high-concurrency simulation and circuit breaker verification.
- **Portfolio Rebalancing Scaffold:** Kelly-optimized weight management logic.
- **Mainnet Readiness Checklist:** Verification script for production deployment.

## [v1.3.0] - 2026-06-27
### Added
- **Exchange Depth:** Full `ccxt` integration for multi-exchange support.
- **Advanced Order Types:** Implementation of OCO and Stop-Limit orders.
- **Unified OrderManager:** Centralized control for all order types.
- **Real-Time Order Book:** L2 WebSocket support and market impact (slippage) analysis.
- **Sub-Second Execution:** EIP-712 template caching and parallel risk/signing tasks.
- **Dynamic Fee Optimizer:** Automated fee tier selection based on market conditions.
- **API Versioning:** Support for `/v1/api` and `/v2` stub routes.

## [v1.2.0] - 2026-06-20
### Added
- **Multi-User Dashboards:** Auth middleware and persistent session management using SQLite.
- **Dashboard Login:** Professional glassmorphism login page.
- **Beta Access Program:** User registration and API key issuance.
- **Feedback Loop:** Reputation-linked user feedback system.
- **Binance Hardening:** Request weight tracking and fail-fast throttling.
- **Manual SDK Guide:** Documentation for sandboxed npm publication.

## [v1.1.0] - 2026-06-13
### Added
- **API Rate Limiting:** Enforcement of per-minute limits on REST and Socket.io.
- **Encrypted API Keys:** AES-256-GCM storage for Sentinel access keys.
- **Sentinel SDK:** Core extraction for pluggable agent integration.
- **Auto-Recovery:** Exponential backoff and circuit breaker logic in ExecutionProxy.
- **Reputation Registry:** On-chain agent reputation tracking.
- **Kelly Sizing:** Fractional position sizing logic.

## [v1.0.0] - 2026-06-06
### Added
- **Sentinel Core:** Verifiable risk-management layer.
- **EIP-712 Signing:** Cryptographically signed TradeIntents.
- **Audit Trails:** Verifiable proof-of-security logs.
- **Dashboard v1:** Real-time Risk Terminal and Operations center.
