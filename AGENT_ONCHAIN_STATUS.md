# 🌐 Vertex Sentinel: On-Chain Audit Report (Sepolia)

This report provides a comprehensive overview of the agentic ecosystem on the Sepolia testnet, specifically focusing on the **Agent Registry**, **Reputation Registry**, and **Validation Registry** shared infrastructure.

## 🛡️ Vertex Sentinel Alpha (Our Agent)

| Metric | Value |
|--------|-------|
| **Agent ID** | 1 |
| **Wallet Address** | `0x5367f88e7b24bfa34a453cf24f7be741cf3276c9` |
| **Reputation Score** | 30 |
| **Avg Validation Score** | 15.5 |
| **Total Attestations** | 108 |

---

## 📊 Ecosystem Summary

A total of **51 agents** are currently registered in the `AgentRegistry`. Below is the status of active agents with validation history or significant reputation.

### Active Agents Audit Trail

| ID | Wallet Address | Reputation | Avg Validation | Attestations |
|----|----------------|------------|----------------|--------------|
| 0 | `0xe55d7936e7bd88d2de63c11a93ae94cc2225dffb` | 95 | 87.9 | 3092 |
| 1 | `0x5367f88e7b24bfa34a453cf24f7be741cf3276c9` | 30 | 15.5 | 108 |
| 2 | `0x349515467f82c3cbe0940fe614fc8038dca98b7c` | 89 | 79.3 | 38 |
| 4 | `0xe15c358c468e9ea52e3695071dc7d9111dc83a0a` | 93 | 86.8 | 100 |
| 5 | `0x982e92b3ef679e00ef933148e27cca62bbe7c1ef` | 80 | 61.2 | 679 |
| 6 | `0xed4c3a2508ade21cd431f7eb8f3d2e7c42f1b307` | 76 | 52.2 | 254 |
| 11 | `0x6b8d4fa82d4bdf70ca0d676bd933b1150705ed9b` | 90 | 81.2 | 416 |
| 17 | `0x95c8b49c2a6124c436ea1a3f378991313f6f1c0a` | 99 | 98.9 | 461 |
| 18 | `0xe8684cfba08541c607898e55bab58302204ddcd7` | 99 | 99.0 | 2146 |
| 31 | `0xbb78252f4a1f03c1b82eefe21eee2d56b5278650` | 98 | 97.8 | 348 |
| 37 | `0x7a2f2e58b93ac448ff7d0e81c2756a3efc7a15e0` | 100 | 100.0 | 613 |
| 39 | `0x0858e4883e88393a5734af2b3f05f4ccdf25c328` | 99 | 100.0 | 65 |

---

## 🔍 Methodology

Data was gathered using JSON-RPC calls via `curl` to a public Sepolia RPC endpoint (`https://ethereum-sepolia-rpc.publicnode.com`).

### Contract Addresses
- **AgentRegistry**: `0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3`
- **ReputationRegistry**: `0x423a9904e39537a9997fbaF0f220d79D7d545763`
- **ValidationRegistry**: `0x92bF63E5C7Ac6980f237a7164Ab413BE226187F1`

### Data Extraction
- **Identity**: Parsed `AgentRegistered` events from the `AgentRegistry`.
- **Validation**: Aggregated `AttestationPosted` events from the `ValidationRegistry`.
- **Reputation**: Parsed reputation update logs from the `ReputationRegistry`.

---
*Report Generated: April 2026*
