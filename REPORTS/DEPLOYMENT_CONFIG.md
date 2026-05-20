# Deployment Configuration - Vertex Sentinel

## CI/CD Pipeline Analysis
- **CI Workflow (`ci.yml`)**:
    - Triggers on push/PR to `main`.
    - Steps: Dependencies (npm ci), Spec Immutability check, Compile Contracts, Type Safety, Integration Tests, SDK Build/Smoke, Docs Sync.
    - **Note**: Uses mock keys for testing.
- **CD Workflow (`cd.yml`)**:
    - Triggers on push to `main` or release.
    - Target: Sepolia Testnet.
    - Steps: Environment Validation (`scripts/check_env.ts`), Deployment Script (`scripts/deploy_sepolia.ts`).
    - **Security**: Uses GitHub Secrets for `AGENT_PRIVATE_KEY` and `INFURA_KEY`.

## Deployment Recommendations
- **Hosting**: Recommended Docker-based hosting for the Agent Brain (e.g., AWS ECS, Heroku, or a dedicated VPS).
- **Environment**: Ensure `NETWORK=sepolia` and all required keys from the `ENV_MATRIX.md` are present in the hosting environment.
- **Circuit Breaker**: Monitor `logs/HALTED` on the host to detect persistent failures.

## Rollback Plan
1. **On-Chain**: If `RiskRouter.sol` deployment fails or is compromised, deploy a fresh instance and update the agent config.
2. **Off-Chain**: Revert to the previous stable Docker image or Git commit.
3. **Emergency**: Use the `haltSystem` functionality to stop all trading immediately.
