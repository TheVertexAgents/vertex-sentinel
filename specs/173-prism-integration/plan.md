# Implementation Plan: Prism Asset Resolution

**Branch**: `173-prism-integration` | **Date**: 2026-05-06 | **Spec**: [spec.md](spec.md)

## Summary
Refactor the asset resolution logic to use the Strykr PRISM API for canonical symbol and precision resolution. This eliminates duplicate logic in `agent_brain.ts`, ensures strict Zod validation of API responses, and implements a resilient qualitative fallback to maintain "Robust" operations during API outages.

## Technical Context

**Language/Version**: TypeScript (Strict Mode)  
**Primary Dependencies**: Zod, fetch (Native), logger  
**Storage**: N/A (Stateless metadata resolution)  
**Testing**: Vitest (Unit & Integration)  
**Target Platform**: Node.js v20+  
**Project Type**: Agent Logic Utility  
**Performance Goals**: < 100ms average resolution latency (excluding network)  
**Constraints**: 5-second timeout, zero process halts, Fail-Safe Fallback  
**Scale/Scope**: ~10 core trading pairs (BTC, ETH, SOL, etc.)

## Constitution Check

*GATE: Must pass before Phase 1 research. Re-check after Phase 2 design.*

- [x] **No `any` types**: All API responses validated with Zod schemas.
- [x] **Fail-Closed logic**: Invalid PRISM responses trigger safe fallbacks instead of halting or guessing.
- [x] **Viem/Zod**: Zod used for all boundary validation (API responses).
- [x] **Gas & EIP-712**: N/A for this metadata feature.
- [x] **Immutability Check**: AssetResolution entity defined in spec.

## Project Structure

### Documentation (this feature)

```text
specs/173-prism-integration/
├── plan.md              # This file
├── spec.md              # Feature specification
└── checklists/
    └── prism_integration.md # Requirements quality checklist
```

### Source Code (repository root)

```text
src/
└── logic/
    ├── agent_brain.ts      # [MODIFY] Replace internal getAssetResolution
    └── strategy/
        └── prism.ts        # [UPDATE] Core resolution logic with Zod
```

**Structure Decision**: Single project refactoring. Centralizing logic from `agent_brain.ts` into the existing `strategy/prism.ts` utility.

## Phase 0: Outline & Research

1. **Verify PRISM API Response Schema**: Research current Strykr PRISM API response format to ensure Zod schema accuracy.
2. **Identify Refactor Points**: Map all calls to `getAssetResolution` in `agent_brain.ts`.

## Phase 1: Design & Contracts

1. **Define Zod Schema**: Create a `PrismResolutionSchema` in `prism.ts`.
2. **Update Prism Module**: Implement timeout, Zod validation, and fallback logic in `prism.ts`.
3. **Refactor Brain**: Swap internal function for module import.
