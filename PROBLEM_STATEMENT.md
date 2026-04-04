# Problem Statement: CI Pipeline Failures on PR #43 (Path B Migration)

## Background

The **Vertex Sentinel Layer** project is a verifiable risk-management agent competing in the **ERC-8004 Hackathon**. The project recently migrated from a local contract deployment ("Path A") to the official shared infrastructure ("Path B"), which uses standardised on-chain contracts at fixed Sepolia testnet addresses managed by the hackathon organisers.

This migration was implemented in the `feat/erc-8004-shared-migration` branch and submitted as **PR #43**. The PR introduced a refactored `TradeIntent` EIP-712 struct aligned with the official Path B specification and a local audit trail (`checkpoints.jsonl`) for judge review.

---

## Problem

PR #43 failed **two mandatory CI checks**, blocking the merge to `main`:

### 1. Spec Immutability Check

**Failure**: `git diff --exit-code` detected uncommitted changes to `src/logic/generated_types.ts`.

**Root cause**: The `generated_types.ts` file is auto-generated from `.specify/spec/vertex-sentinel.yaml` via `npm run generate:types`. However, the YAML spec was **never updated** to reflect the Path B `TradeIntent` struct. The spec still defined the legacy fields (`agentId: string`, `volume: float`, `maxPrice: float`), while the committed `generated_types.ts` contained the new Path B fields (`agentId: bigint`, `agentWallet`, `amountUsdScaled`, `nonce`, `maxSlippageBps`). Re-running the generator from CI produced a file matching the *old* spec, thus creating a diff.

```diff
- agentId: bigint;
- agentWallet: `0x${string}`;
+ agentId: string;
  pair: string;
- action: string;
- amountUsdScaled: bigint;
- maxSlippageBps: bigint;
- nonce: bigint;
+ volume: bigint;
+ maxPrice: bigint;
  deadline: bigint;
```

### 2. Build, Lint & Type Safety Check

**Failure**: `npx tsc --noEmit` exited with 2 errors.

| Error | Location | Description |
|---|---|---|
| `TS6133` | `src/logic/agent_brain.ts:1` | `parseEther` imported but never used — leftover from Path A. |
| `TS2345` | `test/integration/full_loop.test.ts:102` | Test intent object used old struct shape (`agentId: string`, `volume`, `maxPrice`), incompatible with the updated `TradeIntent` interface. |

### 3. Pipeline Overhead (Secondary)

The CI pipeline runs **three independent jobs** (`build`, `spec-validation`, `test`), each spinning up a fresh runner and installing dependencies separately. This results in ~3× redundant `npm ci` overhead, slowing feedback and consuming unnecessary CI minutes.

---

## Impact

- **PR #43 is blocked** from merging to `main`, stalling the hackathon submission branch.
- The local contract (`RiskRouter.sol`) retains the legacy struct, creating divergence between the on-chain test environment and the Path B submission script used for live judging.
- The CI pipeline's three-job structure introduces unnecessary friction for a fast-moving hackathon project.

---

## Resolution Plan

1. **Update the spec** (`.specify/spec/vertex-sentinel.yaml`) to match the official Path B `TradeIntent` fields.
2. **Regenerate types** (`npm run generate:types`) and commit the result so the spec immutability check passes.
3. **Remove the unused import** (`parseEther`) from `agent_brain.ts`.
4. **Update the integration test** (`full_loop.test.ts`) to use the new struct fields and EIP-712 type definitions.
5. **Update the local `RiskRouter.sol`** struct to remain consistent with the Path B definition used in tests.
6. **Simplify the CI pipeline** to a single `verify` job — Install → Generate Types → Spec Check → Compile → Type Check → Test — eliminating redundant setup overhead.

---

## Definition of Done

- `npx tsc --noEmit` exits with **0 errors**.
- `npm run generate:types && git diff --exit-code` produces **no diff**.
- `npm run test` passes all integration tests.
- CI pipeline completes in a **single job** using **Node.js 20 (LTS)**.
- PR #43 CI checks all pass and the branch is ready to merge.
