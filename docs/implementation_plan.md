# Implementation Plan: Phase 3 - Shared Contract Migration (ERC-8004)

This plan outlines the migration from self-deployed/mock contracts to the official shared Hackathon infrastructure on Sepolia. This is a critical step for leaderboard eligibility and verified execution.

## User Review Required

> [!IMPORTANT]
> - **Shared Infrastructure**: We are switching to the official addresses provided by `Steve | lablab.ai`. 
> - **Agent Re-registration**: Any existing agent IDs must be re-registered on the new `AgentRegistry` (`0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3`).
> - **Fail-Closed Verification**: We must ensure `agent_brain.ts` correctly validates trade intents against the new `RiskRouter` address.

## Proposed Changes

### Phase 3: Shared Contract Integration
Initialize the technical stack and configuration for the official testnet environment.

#### [MODIFY] [deployments_sepolia.json](file:///home/asif1/hackathons/VertexAgents-The-Sentinel-Layer/deployments_sepolia.json)
- Replace mock addresses with official ones:
    - `AgentRegistry`: `0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3`
    - `HackathonVault`: `0x0E7CD8ef9743FEcf94f9103033a044caBD45fC90`
    - `RiskRouter`: `0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC`
    - `ReputationRegistry`: `0x423a9904e39537a9997fbaF0f220d79D7d545763`
    - `ValidationRegistry`: `0x92bF63E5C7Ac6980f237a7164Ab413BE226187F1`

#### [MODIFY] [ROADMAP.md](file:///home/asif1/hackathons/VertexAgents-The-Sentinel-Layer/docs/ROADMAP.md)
- Synchronize local roadmap with the latest Notion status (Phase 3: Day 9).
- Document current stand: "Phase 3 finalized; transitioning to official testnet integration".

### Phase 4: Final Validation & Submission
- Run `specify check` to ensure YAML specs are consistent.
- Verify `agent_brain.ts` loads the official `RiskRouter` address (EIP-712 domain verification).
- Check Notion ROADMAP and update status to "DONE" for completed milestones.

## Current Stand (Where we are)
- **Phase 1 (Hardening)**: 100% DONE. Core logic and EIP-712 signing verified.
- **Phase 2 (Integration)**: 100% DONE. Genkit Risk Scoring and Event-Driven Proxy implemented.
- **Phase 3 (Deployment)**: STARTING. Switching to official ERC-8004 shared contracts. Kraken MCP modularization is in progress and stable.

## Verification Plan

### Automated Tests
- Run `npm run test` to ensure `agent_brain` still loads configuration correctly.

### Manual Verification
- Log the `config.riskRouter` in `agent_brain.ts` to confirm it matches the official address.
- Verify Notion page update visually via tool output.
