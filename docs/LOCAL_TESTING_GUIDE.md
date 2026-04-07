# Local Testing & Integration Guide

This document provides instructions on how to run a full "Live" integration of the Sentinel Layer on your local machine, bypassing mocks to test the end-to-end flow with a local Hardhat node and a real (or real-behaving) Kraken CLI.

## 1. Environment Setup

Ensure your `.env` file is correctly configured with valid formats, even if using local networks:

```env
# On-Chain Configuration
AGENT_PRIVATE_KEY=0x... (Your local test account PK)
INFURA_KEY=... (Required for Sepolia, not for local)
NETWORK=local

# Agent Identity
GOOGLE_GENAI_API_KEY=...
KRAKEN_API_KEY=...
KRAKEN_SECRET=...
```

## 2. Start Local Hardhat Node

Open a new terminal and start the local Ethereum node:

```bash
npm run node
```

## 3. Deploy Contracts Locally

In another terminal, deploy the Sentinel contracts to your local node:

```bash
npx hardhat run scripts/deploy_sepolia.ts --network localhost
```
*Note: Although the script is named `deploy_sepolia.ts`, it is compatible with any network specified via the `--network` flag.*

## 4. Run the Full Integration Loop

You can run the `demo_flow.ts` script which orchestrates a complete trade lifecycle:
1. **Risk Assessment**: Fetches real ticker data via MCP.
2. **Intent Signing**: Generates EIP-712 signature.
3. **On-Chain Authorization**: Submits intent to the local RiskRouter.
4. **Execution Proxy**: Detects the event and executes the trade via Kraken MCP.

```bash
npm run demo
```

## 5. Bypassing Mocks in Unit Tests

By default, unit tests use Sinon stubs or environment overrides to remain deterministic. To run tests against your active local environment:

1. **Ensure the local node is running** (`npm run node`).
2. **Deploy contracts** as shown in step 3.
3. **Run integration tests** specifically:

```bash
NODE_ENV=development NETWORK=local npx mocha test/integration/full_loop.test.ts
```

## 6. Verifying Execution

- **Audit Logs**: Check `logs/audit.json` for the full cryptographic trail of the session.
- **PnL Snapshots**: Check `logs/pnl.json` for the realized/unrealized profit calculation.
- **Dashboard**: Run `npm run dashboard` and navigate to `http://localhost:3000` to see the live feed.

## 7. Troubleshooting

- **Nonce Errors**: If you restart your Hardhat node, you may need to reset your Metamask account or clear the local `nonce` state if you are using persistent wallets.
- **MCP Connection**: Ensure the `KRAKEN_CLI_PATH` in your environment points to a valid executable if you are testing with a real Kraken CLI binary instead of the provided Node.js shim.
