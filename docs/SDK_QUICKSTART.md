# 🚀 Developer Quick-Start: Vertex Sentinel SDK

**Give your AI agent a "Security Brain" in 3 simple steps.**

## 1. Installation & Config
Add the Sentinel SDK to your OpenServ or TypeScript agent project.

```bash
npm install @vertex-agents/sentinel-sdk
```

Configure your environment with your agent's private key and the Sentinel Router address.

```typescript
// .env
AGENT_PRIVATE_KEY=0x...
SENTINEL_ROUTER_ADDRESS=0x... // (Sepolia / Mainnet)
```

## 2. Initialize the Sentinel Client
Create a new `SentinelClient` and connect it to your preferred network.

```typescript
import { SentinelClient } from '@vertex-agents/sentinel-sdk';
import { parseEther } from 'viem';

const sentinel = new SentinelClient({
  network: 'sepolia',
  routerAddress: process.env.SENTINEL_ROUTER_ADDRESS,
  privateKey: process.env.AGENT_PRIVATE_KEY,
});
```

## 3. Authorize & Execute a Trade
Before sending an order to an exchange, run it through the Sentinel. The SDK will handle:
- **Genkit Risk Assessment** (AI-powered reasoning)
- **EIP-712 Signing** (Cryptographic proof of intent)
- **On-Chain Pre-Verification** (Optional check against contract state)

```typescript
// 1. Build your TradeIntent
const intent = {
  agentId: 'MY_AGENT_001',
  pair: 'BTC/USDC',
  volume: parseEther('1.5'),
  maxPrice: parseEther('65000'),
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
};

// 2. Get Sentinel Authorization
const auth = await sentinel.authorize(intent);

// 3. Handle the Sentinel Verdict
if (auth.isAllowed) {
  console.log(`✅ Sentinel Authorized: ${auth.reason}`);
  console.log(`Signature: ${auth.signature}`);

  // Proceed to your execution layer (e.g., Kraken, Uniswap)
  // await executeTrade(intent, auth.signature);
} else {
  console.error(`🚫 Sentinel REJECTED: ${auth.reason}`);
  // Trade is blocked (Fail-Closed)
}
```

---

## 🛡️ The "Fail-Closed" Guarantee
The Sentinel SDK ensures that if your agent's risk score exceeds the threshold (default: 0.8) or if the signature is invalid, the `auth.isAllowed` flag will be `false`. Your execution logic should **always** check this flag before proceeding.

**"Security isn't a feature; it's a foundation."**
*Vertex Sentinel SDK v1.0.0-Beta*
