# Investor Pitch — Institutional Guardrails & SDK

Version: 1.1

This short investor-facing summary highlights two pillars critical to our GTM and enterprise adoption: Institutional Guardrails and the Developer SDK.

## Institutional Guardrails (Multisig + Pause)

- Emergency Pause: RiskRouter now supports an on-chain `pause()` / `unpause()` mechanism. This allows the protocol owner or a designated multisig (e.g., Gnosis Safe) to halt authorizations and configuration changes instantly during incidents or audits.
- Multisig Ownership: Deployments should set a multisig as the `multisigOwner` via `setMultisigOwner()` to ensure governance and compliance controls are enforced by a distributed key.
- Audit Readiness: Pausing provides a non-destructive safety net that auditors and compliance teams expect before production launches; it complements formal audits and insurance conversations.

## Developer SDK — Core GTM Asset

- The @vertex-agents/sentinel-sdk packages risk enforcement, EIP-712 signing, and on-chain connectivity into a single, lightweight library.
- SDK improvements include: explicit domain-specific errors, examples (trading_bot), a smoke-testable build, and robust documentation for operators and integrators.
- These SDK features drastically reduce integration friction for enterprise partners and are core to our pilot sales motion.

## Why this matters to investors

Combining on-chain emergency controls with a developer-friendly SDK enables enterprise procurement: finance, legal, and SRE teams can require a pause-and-approve workflow while engineering teams adopt the SDK for fast integration. This dual-sided readiness accelerates pilot signings and shortens sales cycles.

---

*See `docs/guides/user_guide.md` and `contracts/RiskRouter.sol` for technical references.*