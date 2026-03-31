<!--
Sync Impact Report:
- Version change: 1.0.0 → 2.0.0
- Modified principles:
    - Mission Update: Focus on high-stakes autonomous trading and security metrics.
    - Tech Stack Enforcement: TypeScript (Strict/No 'any'), Viem, Zod.
    - Mandatory Guardrails: Implementation of 'Fail-Closed' requirement.
- Added sections:
    - Blockchain & Hackathon Best Practices (Gas, EIP-712, Structured Logging, Atomic Ops).
    - Coding Style (Functional Programming, Defensive Programming).
- Templates requiring updates:
    - .specify/templates/plan-template.md (⚠ pending execution)
    - .specify/templates/spec-template.md (⚠ pending execution)
    - .specify/templates/tasks-template.md (⚠ pending execution)
- Follow-up TODOs: 
    - Ensure `json-schema-to-typescript` is configured in the project.
-->

# Project Constitution: VertexAgents - The Sentinel Layer (v2.0.0)

## 1. Core Mission
To provide a verifiable, high-integrity risk-management and transaction-authorization layer for high-stakes autonomous trading. In this environment, **reliability and security are our only primary metrics**. Speed and throughput must never compromise the integrity of a signed trade intent.

## 2. Technical Stack Enforcement (Strict)
To minimize the surface area for runtime errors and vulnerabilities, the following stack is non-negotiable:
- **Language**: TypeScript (Node.js/Next.js) for all middleware and agent orchestration. 
    - **No "any" types allowed**.
    - Strict type-checking (`tsconfig` strict mode) must be enabled and passing.
- **Blockchain**: **Viem** for all Ethereum interactions. Zero dependency on Web3.js or Ethers.v5 is mandated to maintain modern, lightweight, and type-safe interactions.
- **Contract Interaction**: Solidity contracts must follow OpenZeppelin standards. All contract interactions must use specific `Abi` types derived directly from build artifacts.
- **Validation**: **Zod** must be used for all schema validation at the system boundaries (API inputs, environment variables, RPC responses).

## 3. Mandatory Security Guardrails

### The "Fail-Closed" Principle
If any part of the `risk-gate-protocol` (Genkit flow, signature validation, or allowance check) returns `undefined`, an unexpected value, or an error, the system must immediately throw a `CriticalSecurityException` and halt execution. **Never default to "allow" on error.**

### Immutability of Specs
The files in `spec/*.yaml` (or `spec/*.json`) are the exclusive source of truth for the system's data contracts. 
- The agent **MUST** generate TypeScript types using `json-schema-to-typescript` (or equivalent) automatically upon any spec change.
- Manual duplication of interfaces is strictly prohibited.

### Environment Isolation
Secrets and configuration must never be hardcoded. The system must enforce a `process.env` validation schema using Zod upon application startup.

## 4. Blockchain & Hackathon Best Practices

- **Gas Efficiency**: Every transaction proposal from the agent must include a gas estimation check (e.g., `estimateGas` via Viem) before submission to prevent stuck transactions or excessive cost.
- **EIP-712 / Typed Data**: All sensitive agent actions must use EIP-712 Typed Data signing. This ensures that the intent is human-readable and machine-verifiable, preventing "blind signing" of opaque hex data.
- **Logging (Structured JSON)**: All validation steps (Risk Score, Signature, Nonce, Gas) must be logged as **structured JSON**, not plain strings. This enables precise debugging and automated auditing during the hackathon presentation.
- **Atomic Operations**: Favor multicall contracts to ensure multiple related state changes (e.g., set allowance and swap) occur atomically or not at all.

## 5. Coding Style

- **Functional Programming**: Minimize mutable state in the TypeScript layer. Use pure functions for risk assessment logic and state transformations.
- **Defensive Programming**: Every input from the Blockchain RPC or User Input must be sanitized and validated against the Zod schemas generated from our `spec/` configuration. Assumed valid state is a failure state.

---

## Governance
This constitution supersedes all other documentation. 
- **Amendments**: Require a version bump (Semantic Versioning) and a corresponding Sync Impact Report.
- **Compliance**: All Implementation Plans must perform a "Constitution Check" before execution.

**Version**: 2.0.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-29
