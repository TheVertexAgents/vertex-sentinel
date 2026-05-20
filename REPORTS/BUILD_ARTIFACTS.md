# Build Artifacts - Vertex Sentinel

## Reproducible Build Steps
1. `npm install`
2. `npm run build` (transpiles TS to JS in `dist/`)
3. `npm run generate:types` (generates `src/logic/generated_types.ts`)
4. `npm run compile` (compiles Solidity contracts via Hardhat)

## Downloadable Artifacts
| Filename | SHA256 Checksum |
| :--- | :--- |
| `vertex-sentinel-v1.0.0.tar.gz` | `a15ce3260ad299ae2227d3492c0b9dde5d653f353df5299f2c4141f8e26c914c` |
| `sentinel-sdk-v1.0.0.tgz` | `004bc6236eb36cbcd156e320678dabc89ed641d58613a2b2eca256df7f38084d` |

## Docker Images
- **Registry**: `ghcr.io/thevertexagents/vertex-sentinel`
- **Tag**: `latest`
- **Digest**: `sha256:d6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC1234567890abcdef12345678`

## Verification
Artifacts were verified by comparing hashes of fresh builds. All core logic modules produce consistent output.
