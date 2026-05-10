# @vertex-agents/sentinel-sdk

The official SDK for the Vertex Sentinel Layer — the verifiable risk-management layer for autonomous AI trading agents.

## Installation

```bash
npm install @vertex-agents/sentinel-sdk
```

## Features

- **EIP-712 Signing**: Securely sign trade intents for on-chain verification.
- **Fail-Closed Enforcement**: Built-in security that halts execution on risk violations.
- **On-Chain Connectivity**: Direct interaction with the `RiskRouter` on Sepolia and Mainnet.
- **Lightweight**: Zero-dependency on agent runtimes (no `ccxt`, `genkit`, etc).

## Quick Start

```typescript
import { SentinelClient } from '@vertex-agents/sentinel-sdk';

const sentinel = new SentinelClient({
  network: 'sepolia',
  routerAddress: '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC',
  privateKey: process.env.AGENT_PRIVATE_KEY,
  agentId: 1
});

// Verifiable Trade Authorization
const auth = await sentinel.authorize({
  agentId: 1n,
  agentWallet: '0x...',
  pair: 'BTC/USD',
  action: 'BUY',
  amountUsdScaled: 100000n, // $1000.00
  maxSlippageBps: 100,
  nonce: 1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
});

if (auth.isAllowed) {
  console.log('Sentinel Authorized:', auth.reason);
  // Proceed with execution using auth.signature
} else {
  console.error('Sentinel Rejected:', auth.reason);
}
```

## Security

Vertex Sentinel uses a **Fail-Closed** security model. This "fail-closed" enforcement ensures that if any part of the verification pipeline fails (signature invalid, risk too high, provider unreachable), the SDK will return `isAllowed: false` or throw a `FailClosedException`.

## License

MIT
