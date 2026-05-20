# Incident Response Playbook - Vertex Sentinel

## Severity Levels

| Level | Description | Action |
| :--- | :--- | :--- |
| **P0 (Critical)** | Private key exposure, major fund loss, system-wide failure to halt. | **HALT IMMEDIATELY**. Rotate keys. Deploy emergency contract fix. |
| **P1 (High)** | API downtime (Kraken/AI), high-stakes trade rejection failure. | Investigate logs. Check circuit breaker status. Manual intervention if needed. |
| **P2 (Medium)** | UI/Dashboard glitches, slow RPC performance, minor PnL desync. | Refresh state. Check RPC provider health. Log for future fix. |

## Standard Procedures

### Emergency Halt
1. Create a `logs/HALTED` file manually or via dashboard.
2. Kill the agent process: `kill $(pgrep -f agent_brain)`.

### Recovery after Halt
1. Diagnose and fix the root cause.
2. Restart the agent with the force-restart flag: `npm start -- --force-restart`.

### Key Rotation
1. Update secrets in GitHub/Vault.
2. Re-deploy the agent with new environment variables.
3. Revoke permissions from old keys on the exchange.

## Contact List
- **Lead Engineer**: VertexAgents <info.vertexagents@gmail.com>
- **Security Lead**: [TBD]
- **On-Call**: [TBD]
