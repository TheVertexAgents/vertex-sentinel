# Feature Specification: Prism Asset Resolution

**Feature Branch**: `173-prism-integration`  
**Created**: 2026-05-06  
**Status**: Draft  
**Input**: User description: "Prism asset resolution integration and refactoring"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Canonical Symbol Resolution (Priority: P1)

The trading agent needs to resolve exchange-specific symbols (e.g. XXBTZUSD) into canonical names and identify price precision using the Strykr PRISM API. This ensures that risk assessment and dashboard reporting are consistent across different exchanges.

**Why this priority**: Correct symbol resolution is fundamental to accurate trading and reporting.

**Independent Test**: Can be tested by calling the PRISM resolver for a known pair (e.g. BTC/USD) and verifying it returns the correct exchange symbol and precision.

**Acceptance Scenarios**:

1. **Given** a valid trading pair, **When** the resolver is called, **Then** it returns the exchange-specific symbol and precision from PRISM.
2. **Given** an invalid or unsupported pair, **When** the resolver is called, **Then** it applies the standard fallback logic.

---

### User Story 2 - Resilient Fallback (Priority: P2)

In high-stakes trading, the system must remain operational even if non-critical external APIs (like PRISM) fail. The system should gracefully fallback to standard CCXT naming conventions if the PRISM API is unavailable.

**Why this priority**: Prevents a single external API failure from halting the entire agent's trading logic.

**Independent Test**: Simulate a PRISM API timeout/failure and verify the agent continues with fallback values.

**Acceptance Scenarios**:

1. **Given** the PRISM API is unreachable, **When** a resolution is requested, **Then** a warning is logged and a qualitative fallback symbol is returned.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch canonical symbol and precision from the Strykr PRISM API (`https://api.prismapi.ai/resolve`) using a **5-second timeout**.
- **FR-002**: System MUST validate the PRISM API response using **Zod schemas** before any data usage. Invalid JSON or schema mismatches MUST trigger the fallback mechanism.
- **FR-003**: System MUST implement a **Fail-Safe Fallback** that defaults to the raw input `pair` string and a default precision of `8` if PRISM fails, is unreachable, or the API key is missing.
- **FR-004**: System MUST refactor `src/logic/agent_brain.ts` by replacing the internal `getAssetResolution` function with the shared `src/logic/strategy/prism.ts` implementation.
- **FR-005**: System MUST log structured JSON for every resolution step, specifically flagging `PRISM_RESOLVED`, `PRISM_TIMEOUT`, or `PRISM_FALLBACK_TRIGGERED`.

### Key Entities

- **AssetResolution**: An object containing the exchange-specific symbol (string) and the asset's price precision (number).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of asset resolution calls in the "Brain" are centralized in the Prism module.
- **SC-002**: Zero "any" types or raw type casts used for PRISM API responses.
- **SC-003**: System maintains a "Robust" state with **zero process halts** (crashes) even when the PRISM API returns 500s or timeouts.

## Assumptions

- **STRYKR_PRISM_API** key is provided in the environment.
- The PRISM API follows the defined JSON structure: `{ "symbol": string, "precision": number }`.
