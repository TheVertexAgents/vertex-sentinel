# 🛠️ Vertex Sentinel Project Roadmap (Hackathon)

## Milestone 1: Sentinel Core Refactor (SDK-Ready)
*Goal: Decouple security logic from demo orchestration and prepare for pluggable integration.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[BUG]** Fix hardcoded `verifyingContract` in `agent_brain.ts` | `P0: Critical` | `TODO` |
| **[REFACTOR]** Extract `SentinelClient` into reusable SDK structure | `P1: Feature` | `TODO` |
| **[TECH DEBT]** Implement automatic type generation from YAML specs | `P2: DevEx` | `TODO` |

## Milestone 2: Intelligent Verifiability (Genkit + Audit)
*Goal: Enhance the risk engine and provide verifiable "proofs" of security.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[FEATURE]** Implement "Security Audit Trail" generator (JSON/Markdown) | `P1: Demo` | `TODO` |
| **[ENHANCEMENT]** Strengthen Genkit risk assessment flow with market context | `P2: Research` | `TODO` |
| **[FEATURE]** Integration of real-time ERC-8004 Identity Verification | `P2: Strategic` | `TODO` |

## Milestone 3: Productization & Marketing (GTM)
*Goal: Positioning the Sentinel Layer as a "Security SDK" for the OpenServ ecosystem.*

| Issue | Label | Status |
| :--- | :--- | :--- |
| **[DOCS]** Create `LITEPAPER.md` (Security Strategy & Value Prop) | `P1: Marketing` | `DONE` ✅ |
| **[DOCS]** Draft "Developer Quick-Start" Guide for SDK | `P2: Marketing` | `DONE` ✅ |
| **[RESEARCH]** OpenServ SDK Integration & Conceptual API Design | `P1: Research` | `DONE` ✅ |
| **[DEMO]** Create "One-Click Fail-Closed" simulation script | `P1: Demo` | `TODO` |

---

## 🏷️ Label Definitions:
- `P0: Critical`: Essential for any functional demo or security integrity.
- `P1: Feature`: High-impact features that drive the "Security SDK" narrative.
- `P1: Demo`: Enhancements specifically for the "Wow Factor" during screen-sharing.
- `P1: Marketing`: Essential for hackathon requirements and project positioning.
- `P1: Research`: Documentation of integration patterns and future architecture.
- `P2: DevEx`: Developer experience improvements for long-term project health.
- `P2: Research`: Deeper R&D items for the future roadmap.
- `P2: Strategic`: Long-term ecosystem alignment (e.g., ERC-8004).
