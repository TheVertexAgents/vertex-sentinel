# VertexAgents-Sentinel-PRO Initialization & Backup Plan

This plan outlines the steps to safely transition from the current `VertexAgents-The-Sentinel-Layer` workspace to a fresh `VertexAgents-Sentinel-PRO` workspace, ensuring that the critical "Constitution" and YAML specifications are preserved and restored correctly.

## User Review Required

> [!IMPORTANT]
> - The original plan referenced `/home/asif1/hackathons/VertexAgents-The-Sentinel-Layer/spec/` for YAML files, but they are actually located at `/home/asif1/hackathons/VertexAgents-The-Sentinel-Layer/.specify/spec/`. I have updated the plan to use the correct source paths.
> - I will create a dedicated `VertexAgents-Sentinel-Backup` directory first to act as a safety net before initializing the PRO workspace.

## Proposed Changes

### Phase 0: The Safety Net (Backup)
Before starting fresh, we will capture the current state of your "Intellectual Property".

- Create `~/hackathons/VertexAgents-Sentinel-Backup/`
- Copy `constitution.md` from `.specify/memory/`
- Copy YAML specs from `.specify/spec/`

### Phase 1: The Pristine Setup (PRO)
Initialize the new workspace directory and structure.

- Create `~/hackathons/VertexAgents-Sentinel-PRO`
- Initialize Git
- Create a strict `.gitignore`
- Create directory structure: `src/lib`, `src/contracts`, `src/logic`, `spec`

### Phase 2: Spec Kit & Dependency Injection
Initialize the technical stack.

- `npm init -y`
- Install dependencies: `viem`, `zod`, `json-schema-to-typescript`, `typescript`, `ts-node`, `@types/node`
- Initialize Spec Kit with Antigravity (`specify init --here --ai agy --ai-skills`)

### Phase 3: The Restoration
Restore the IP from the backup into the PRO workspace.

- Restore `constitution.md` to `.specify/memory/`
- Restore YAML specs to `./spec/`

### Phase 4: Final Validation
- Run `specify check`
- Verify constitution content
- Initial commit and branch creation (`feature/sentinel-core`)

## Open Questions

- Are there any other hidden config files (e.g., specific `.env` templates) in the current workspace that you want migrated to the backup?

## Verification Plan

### Manual Verification
- I will run `ls -R` in the new PRO workspace after restoration to verify file placement.
- I will run `grep` on the restored constitution to confirm integrity.
- I will run `specify check` and confirm the output.
