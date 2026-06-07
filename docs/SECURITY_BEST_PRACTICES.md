# 🛡️ Vertex Sentinel — Security Best Practices

Vertex Sentinel is an institutional-grade risk management layer. To ensure the safety of your assets and the integrity of your AI agents, follow these security best practices.

---

## 1. Secret Management

**NEVER** hardcode private keys or API secrets in your source code.

*   **Environment Variables:** Use `.env` files for local development and ensure they are listed in your `.gitignore`.
*   **Secret Managers:** In production, use AWS Secrets Manager, Google Secret Manager, or HashiCorp Vault.
*   **Encrypted Storage:** If you must store keys on disk (like the Sentinel API Key Manager), use strong encryption (AES-256-GCM) with a master key sourced from a secure environment variable.

## 2. EIP-712 Signature Verification

All `TradeIntent` objects must be signed using EIP-712 to prevent replay attacks and ensure authenticity.

*   **Verifying Contract:** Always double-check that the `verifyingContract` address in the EIP-712 domain matches the official `RiskRouter` deployment on your target network.
*   **Nonce Tracking:** Sentinel uses nonces to prevent replay attacks. Ensure your agent increments the nonce for every new intent.
*   **Deadlines:** Set reasonable deadlines for intents (e.g., 5–10 minutes). Stale intents should be rejected by the Sentinel layer.

## 3. Circuit Breaker Configuration

The `ExecutionProxy` includes a fail-closed circuit breaker.

*   **Thresholds:** The default is 3 consecutive failures. Adjust this based on your exchange's stability and your risk tolerance.
*   **Cooldown:** The default cooldown is 5 minutes. During this period, all trades are blocked.
*   **Self-Healing:** Sentinel automatically attempts to recover after the cooldown period. Monitor `risk.alert` events to detect persistent issues.

## 4. Rate Limiting

If you are building a custom dashboard or multi-user platform on top of Sentinel:

*   Apply rate limiting to all API endpoints.
*   Throttle WebSocket connections to prevent DDoS attacks.
*   Use the `express-rate-limit` middleware as demonstrated in the Sentinel core.

## 5. Pre-commit Hooks

Use GitGuardian or similar tools to prevent accidental leakage of secrets.

*   Install the GitGuardian CLI.
*   Run `ggshield install --mode local` in your repository.
*   Configure `.gitguardian.yaml` to exclude known safe patterns.

## 6. Multi-User Authentication & Session Management

With the introduction of the multi-user dashboard, authentication is enforced at every layer.

*   **API Key Isolation:** Each user or operator should have their own unique Sentinel API key issued via the Beta Access Program.
*   **Session Security:** Session tokens are stored in `localStorage` in the browser. Always serve the dashboard over HTTPS to prevent token theft via man-in-the-middle attacks.
*   **Key Rotation:** Regularly rotate API keys via the `/v1/api/keys/rotate` endpoint. Old keys are invalidated immediately.
*   **Role-Based Access Control (RBAC):** Users are assigned roles (e.g., `admin`, `viewer`). `viewer` roles are restricted from high-stakes actions like toggling automation or rotating keys.

## 7. Binance API Key Scoping

When integrating Binance via the Sentinel adapter:

*   **Restrict IP Access:** In the Binance dashboard, restrict your API keys to the specific IP address of your Sentinel server.
*   **Permission Minimization:** Only enable "Spot & Margin Trading". **NEVER** enable "Withdrawals" for keys used by AI agents.
*   **Weight Management:** Monitor `RATE_LIMIT_WARNING` alerts. Sentinel's weight tracker provides a 100-point buffer before Binance's hard limits are hit.

---

*For more information, see the [Project Constitution](https://github.com/TheVertexAgents/vertex-sentinel/blob/main/README.md).*
