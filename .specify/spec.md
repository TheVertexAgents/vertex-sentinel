# Specification: VertexAgents - The Sentinel Layer

## Project Overview
This specification defines the core behaviors and data contracts for **The Sentinel Layer**, a verifiable risk-management protocol for autonomous AI agents.

## Source of Truth
> [!IMPORTANT]
> This project follows a **Spec-First** methodology. All data contracts and behavior definitions are maintained in YAML files within the `.specify/spec/` directory.

### Current Specs:
- **`.specify/spec/vertex-sentinel.yaml`**: defines the `TradeIntent` entity and the `submit_intent` behavior with its respective guardrails (price, ERC-8004 status, slippage).
- **`.specify/spec/handshake.yaml`**: defines the handshake protocol between the Agent Brain and the Risk Router.

## Behaviors

### 1. `submit_intent` (from `.specify/spec/vertex-sentinel.yaml`)
- **Inputs**: `TradeIntent`
- **Outputs**: `ValidationArtifact`
- **Constraints**:
    - Agent must have an active ERC-8004 Registry ID.
    - Risk score must be validated via Genkit Flow before signing.
    - Slippage and Price triggers must be within defined bounds.

---

## Active Tasks
Current focus is on initializing the Specify environment and codifying the Project Constitution.

See [.specify/memory/constitution.md](file:///home/asif1/hackathons/VertexAgents-The-Sentinel-Layer/.specify/memory/constitution.md) for architectural guardrails.
