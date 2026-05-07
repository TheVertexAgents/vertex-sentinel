# Tasks: Prism Asset Resolution

**Input**: Design documents from `/specs/173-prism-integration/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Tests are included to verify the resolver and fallback logic.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Verify `STRYKR_PRISM_API` entry in `src/logic/env.ts` (Already exists, but confirm Zod schema)

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T002 [P] Define `PrismResolutionSchema` and `AssetResolution` type in `src/logic/strategy/prism.ts`
- [x] T003 [P] Setup structured JSON logging for PRISM events in `src/logic/strategy/prism.ts` (using Constitution §4.50 standards)

---

### Phase 3: User Story 1 - Canonical Symbol Resolution (Priority: P1) 🎯 MVP

**Goal**: Resolve exchange-specific symbols using PRISM API with Zod validation.

**Independent Test**: Call `getAssetResolution("BTC/USD")` and verify it returns a validated object from the PRISM mock/real endpoint.

### Tests for User Story 1

- [x] T004 [P] [US1] Create unit tests for `getAssetResolution` in `test/logic/strategy/prism.test.ts` (verify schema validation)

### Implementation for User Story 1

- [x] T005 [US1] Implement Zod-validated `getAssetResolution` in `src/logic/strategy/prism.ts`
- [x] T006 [US1] Implement 5-second timeout and `AbortController` logic in `src/logic/strategy/prism.ts`

**Checkpoint**: User Story 1 functional (without fallback).

---

## Phase 4: User Story 2 - Resilient Fallback (Priority: P2)

**Goal**: Gracefully fallback to standard naming if PRISM fails.

**Independent Test**: Mock a 500 error or timeout from PRISM and verify `getAssetResolution` returns the input pair and precision 8.

### Tests for User Story 2

- [x] T007 [P] [US2] Add failure-mode tests in `test/logic/strategy/prism.test.ts` (Timeout, 404, Invalid JSON)

### Implementation for User Story 2

- [x] T008 [US2] Implement `try-catch` fallback logic in `src/logic/strategy/prism.ts` using constants for default precision.

**Checkpoint**: System is now robust against PRISM outages.

---

## Phase 5: Refactoring [REF]

**Purpose**: Eliminate duplicate logic and unify resolution.

- [ ] T009 [REF] Update imports in `src/logic/agent_brain.ts` to use `getAssetResolution` from `strategy/prism.js`
- [ ] T010 [REF] Remove internal `getAssetResolution` implementation from `src/logic/agent_brain.ts`
- [ ] T011 [REF] Run full agent smoke test to verify trade intent signing still works with new resolver.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Foundational**: Can start immediately.
- **User Story 1**: Depends on T002 (Schema).
- **User Story 2**: Depends on US1 (Implementation).
- **Refactoring**: Depends on US1 & US2 completion and verification.

### Parallel Opportunities

- T001, T002, T003 can run in parallel.
- Tests (T004, T007) can be written in parallel with their respective story implementations.
