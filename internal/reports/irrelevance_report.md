# Project Irrelevance & Deviation Report (Vertex Sentinel v2.0.0)

This report identifies current project components, configurations, and code patterns that are irrelevant to or deviate from the **Project Constitution v2.0.0**.

## 1. Environment & Runtime
- **Node.js Version**: `README.md` specifies Node 18+, while the updated requirement is Node 20+. `package-lock.json` contains mixed references.
- **Missing Dependencies**: `zod` and `json-schema-to-typescript` are mandated but not present in `package.json`.

## 2. Technical Stack Deviations
- **Blockchain Interactions**: `scripts/demo_flow.ts` heavily relies on `ethers.js` (via `@nomicfoundation/hardhat-ethers`) for contract deployment and interaction. The Constitution mandates **Viem** for all Ethereum interactions.
- **Type Safety**: `any` types are present in `scripts/demo_flow.ts` (e.g., in event log parsing), violating the "No 'any' types allowed" rule.
- **Manual Interfaces**: `src/logic/types.ts` contains manually defined interfaces for `TradeIntent` and `ValidationArtifact`, which duplicates the source of truth in `.specify/spec/*.yaml`.

## 3. Security Guardrails (Missing/Incomplete)
- **Fail-Closed Principle**: The system does not currently throw `CriticalSecurityException`. Errors in the risk-gate-protocol are not consistently handled with a "default-to-deny" mechanism.
- **Environment Validation**: There is no Zod-based validation for `process.env` upon application startup.
- **Input Sanitization**: Boundary inputs (RPC responses, user inputs) are not validated against Zod schemas.

## 4. Blockchain & Hackathon Best Practices
- **Gas Efficiency**: No `estimateGas` checks are performed before submitting transactions in the demo or agent logic.
- **Structured Logging**: All logs are currently plain strings using `console.log`. The Constitution requires **Structured JSON** for validation steps (Risk Score, Signature, etc.).
- **Atomic Operations**: Use of Multicall is suggested but not yet implemented for complex interactions.

## 5. Coding Style
- **Functional Programming**: The current logic in `agent_brain.ts` and `demo_flow.ts` uses some imperative patterns that could be refactored to minimize mutable state.
- **Defensive Programming**: Assumed valid states exist in the interaction between the Brain and Sentinel layers.

## 6. Template Irrelevance
- `.specify/templates/plan-template.md`, `spec-template.md`, and `tasks-template.md` are marked as "pending execution" for v2.0.0 updates and contain placeholders that do not reflect the strict requirements of the new Constitution.
