# Build Artifacts - Vertex Sentinel

## Reproducible Build Steps
1. `npm install`
2. `npm run build` (transpiles TS to JS in `dist/`)
3. `npm run generate:types` (generates `src/logic/generated_types.ts`)
4. `npm run compile` (compiles Solidity contracts via Hardhat)

## Artifact Checksums (Partial List)
| File | SHA256 Checksum |
| :--- | :--- |
| `dist/src/logic/agent_brain.js` | `a15ce3260ad299ae2227d3492c0b9dde5d653f353df5299f2c4141f8e26c914c` |
| `dist/src/execution/proxy.js` | `004bc6236eb36cbcd156e320678dabc89ed641d58613a2b2eca256df7f38084d` |
| `dist/src/onchain/risk_router.js` | `6424f43daed968b6fab996aa0a720658ba842005abc56b2836205eedc3b3e866` |
| `dist/src/mcp/kraken/index.js` | `fa56062ce5a0d933aeb32fc1cbc2bbe0164520e83cb576f071326effe6bf4e67` |

## Verification
Artifacts were verified by comparing hashes of fresh builds. All core logic modules produce consistent output.
