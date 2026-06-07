# @vertex-agents/sentinel-sdk

[![npm version](https://badge.fury.io/js/@vertex-agents%2Fsentinel-sdk.svg)](https://badge.fury.io/js/@vertex-agents%2Fsentinel-sdk)

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

## API Reference

- SentinelClient(options)
  - network: 'sepolia' | 'mainnet' | custom
  - routerAddress: string (RiskRouter address)
  - privateKey: string (agent signing key)
  - agentId: number

- authorize(intent): Promise<{ isAllowed: boolean; reason?: string; signature?: string }>
  - intent: TradeIntent (EIP-712 structured object)
  - Returns isAllowed=false when any validation fails; may throw in exceptional conditions.

- getNonce(agentId): Promise<number>
  - Helper to fetch on-chain nonce for an agent.

## Error Types

The SDK surfaces domain-specific errors to help developers handle common failure modes programmatically:

- InsufficientCollateralError — raised when the agent's collateral is insufficient for the requested intent.
- StalePriceError — raised when the on-chain or oracle price is stale.
- FailClosedException — indicates the system entered fail-closed mode and manual intervention may be required.
- InsufficientQuotaError — when AI or other dependent service quotas are exhausted.

Import these from `@vertex-agents/sentinel-sdk/src/errors` in examples.

## Best Practices

- Nonces: always fetch and increment the on-chain nonce immediately before signing an intent to avoid "Invalid Nonce" rejections.
- Retries: adopt an exponential backoff for transient failures. Treat `isAllowed:false` as business logic (do not blindly retry without investigating `reason`).
- Key management: keep private keys in a secure HSM or vault; avoid embedding in source or CI logs.
- Graceful degradation: implement a conservative execution fallback when Sentinel rejects an intent (paper trading or reduced size).

## Examples

See `packages/sentinel-sdk/examples/trading_bot.ts` for a minimal reference implementation demonstrating authorization, error handling, and best practices.

## Troubleshooting

- "Invalid Signature": ensure the signing key matches the agent wallet registered on-chain.
- "Intent Expired": confirm clock sync and use deadlines with reasonable leeway.
- "Price feed stale": verify Chainlink price feed addresses and oracle update cadence.

## Contributing & Tests

- Run unit tests: `npm test` from repo root.
- Build SDK: `npm run build` inside `packages/sentinel-sdk`.

## License

MIT

