# ERC-8004 Cleanliness Audit: Vertex Sentinel Agent

## Executive Summary
This audit was performed to identify hardcoded logic, mock data, and placeholder integrations within the Vertex Sentinel codebase. The audit reveals a significant "Verifiability Gap" where production-path code utilizes hardcoded fallbacks and registry bypasses that undermine the agent's standing on the ERC-8004 standard. While the agent maintains a strong fail-closed architecture in theory, several implementation-level "mocks" allow it to bypass cryptographic rigor for the sake of development convenience.

## Methodology
The audit utilized a multi-stage discovery process:
1.  **Automated Scan**: Recursive grep-based discovery for keywords (`mock`, `placeholder`, `todo`, `hardcoded`, `fake`, `fallback`) and patterns (zero addresses, magic numbers).
2.  **Strategic Partitioning**: Filtering findings to distinguish between legitimate unit test mocks (`test/`) and high-stakes production vulnerabilities (`src/`, `contracts/`).
3.  **Path Scrutiny**: Manual code review of core controllers (`agent_brain.ts`), on-chain clients (`validation.ts`, `identity.ts`), and the execution layer (`proxy.ts`).
4.  **Impact Modeling**: Analysis of each finding against the ERC-8004 pillars: Reputation Integrity, Cryptographic Verifiability, and Sybil Resistance.

## Critical Findings

### 1. Validation Layer
| Finding | File Path | Line | Snippet | Explanation |
|:--- |:--- |:--- |:--- |:--- |
| **Hardcoded Score** | `src/onchain/validation.ts` | 72 | `args: [agentId, checkpointHash, 100, 1, '0x', notes]` | Always submits a perfect validation score of 100 to the registry without real proof. |
| **Empty Proof** | `src/onchain/validation.ts` | 72 | `'0x'` | Submits an empty byte string instead of the required EIP-712 proof for heartbeats. |

### 2. Identity Layer
| Finding | File Path | Line | Snippet | Explanation |
|:--- |:--- |:--- |:--- |:--- |
| **Registry Bypass** | `src/onchain/identity.ts` | 23 | `if (this.registryAddress === '0x00...00' \|\| process.env.DEMO_MODE === 'true')` | Allows the agent to claim "Registered" status even when no registry is present. |
| **Submission Bypass** | `src/onchain/risk_router.ts` | 150 | `if (this.routerAddress === '0x00...00' \|\| process.env.DEMO_MODE === 'true')` | Skips on-chain intent submission, effectively disabling the Sentinel guardrail. |

### 3. Strategy & Strategy Layer
| Finding | File Path | Line | Snippet | Explanation |
|:--- |:--- |:--- |:--- |:--- |
| **Fallback Price** | `src/logic/agent_brain.ts` | 133 | `realPrice = 67000;` | Uses a hardcoded BTC price if the Kraken API ticker fails, invalidating PnL logs. |
| **Magic Numbers** | `src/logic/strategy/risk_assessment.ts` | 189 | `(spread / 0.02) * 0.5` | Hardcoded risk thresholds that should be dynamic or agent-specific. |
| **Asset Placeholder**| `src/logic/agent_brain.ts` | 118 | `// TODO: Integrate real PRISM API` | Uses a placeholder function for asset resolution instead of a verifiable API. |

## Impact Analysis Table
| Finding Category | ERC-8004 Impact | Severity |
|:--- |:--- |:--- |
| **Validation** | **Reputation Inflation**: Undermines the anti-sybil and reputation metrics of the ERC-8004 ecosystem. | **High** |
| **Identity** | **Verifiability Failure**: Prevents actors from proving the agent is authorized by the registered operator. | **High** |
| **Strategy** | **PnL Fraud Risk**: Hardcoded prices allow for "mocked" performance reporting that cannot be verified on-chain. | **Medium** |
| **Execution** | **Intent Mismatch**: Scaling bugs (18 vs 2 decimals) mean execution does not match authorized intent. | **High** |

## Remediation Roadmap
1.  **Immediate (High Priority)**:
    *   Implement real EIP-712 proof submission in `validation.ts` instead of `0x`.
    *   Connect `agent_brain.ts` to dynamic configuration for all registry addresses.
    *   Fix the decimal scaling bug in `proxy.ts` to ensure USD values match Kraken expectations.
2.  **Short Term (Medium Priority)**:
    *   Remove `DEMO_MODE` guards from production paths; move them to a dedicated `MockIdentityClient` used only in tests.
    *   Replace hardcoded fallback prices with a "Fail-Closed" halt if market data is unavailable.
3.  **Long Term (Architectural)**:
    *   Migrate risk parameters from `risk_assessment.ts` magic numbers to an on-chain `ConfigRegistry` or the `agent-id.json` manifest.

## Appendix: Raw Scan Logs
```
$(cat logs/audit_scan_raw.log | head -n 100)
... [Logs truncated for brevity, full logs available in logs/audit_scan_raw.log]
```
