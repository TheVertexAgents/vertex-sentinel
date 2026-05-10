# 🚀 Developer Quick-Start: Vertex Sentinel SDK

**Give your AI agent a "Security Brain" in 3 simple steps.**

## 1. Installation & Config
Add the Sentinel SDK to your project.

```bash
npm install @vertex-agents/sentinel-sdk
```

## 2. Initialize the Sentinel Client
Create a new `SentinelClient` and connect it to your preferred network.

```typescript
import { SentinelClient } from '@vertex-agents/sentinel-sdk';

const sentinel = new SentinelClient({
  network: 'sepolia',
  routerAddress: '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC',
  privateKey: process.env.AGENT_PRIVATE_KEY,
  agentId: 1
});
```

## 3. Authorize & Execute a Trade
Before sending an order to an exchange, run it through the Sentinel. The SDK will handle EIP-712 signing and fail-closed validation.

```typescript
// 1. Build your TradeIntent
const intent = {
  agentId: 1n,
  agentWallet: '0x...',
  pair: 'BTC/USD',
  action: 'BUY',
  amountUsdScaled: 100000n, // $1000.00
  maxSlippageBps: 100,
  nonce: 1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
};

// 2. Get Sentinel Authorization
const auth = await sentinel.authorize(intent);

// 3. Handle the Sentinel Verdict
if (auth.isAllowed) {
  console.log(`✅ Sentinel Authorized: ${auth.reason}`);
  console.log(`Signature: ${auth.signature}`);

  // Proceed to your execution layer (e.g., Kraken)
} else {
  console.error(`🚫 Sentinel REJECTED: ${auth.reason}`);
  // Trade is blocked (Fail-Closed)
}
```

---

## 🛡️ The "Fail-Closed" Guarantee
The Sentinel SDK ensures that if your agent's risk score exceeds the threshold or if the signature is invalid, the `auth.isAllowed` flag will be `false`. Your execution logic should **always** check this flag before proceeding.

**"Security isn't a feature; it's a foundation."**
*Vertex Sentinel SDK v1.0.0-Beta*
