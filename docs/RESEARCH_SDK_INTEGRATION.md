# Research: Sentinel SDK & OpenServ Integration Concept

## 1. OpenServ SDK Alignment
Our research into the [OpenServ TypeScript SDK](https://github.com/openserv-labs/sdk) reveals a "Capability-based" architecture. To ensure maximum adoption within the OpenServ ecosystem, the Vertex Sentinel should be exposed as a **Security Capability**.

### Proposed Integration Pattern:
An OpenServ agent developer would integrate the Sentinel Layer by adding it as a capability that wraps their execution logic.

```typescript
// Conceptual OpenServ Integration
import { Agent } from '@openserv-labs/sdk';
import { SentinelClient } from '@vertex-agents/sentinel-sdk';

const sentinel = new SentinelClient({
  network: 'sepolia',
  routerAddress: process.env.SENTINEL_ROUTER_ADDRESS,
});

agent.addCapability({
  name: 'secure_trade',
  description: 'Executes a trade with Sentinel protection',
  async run({ args, action }) {
    // 1. Generate Intent
    const intent = { ...args, agentId: action.me.id };

    // 2. Authorize via Sentinel SDK (Genkit Risk Assessment + EIP-712 Signing)
    const auth = await sentinel.authorize(intent);

    if (!auth.isAllowed) {
      throw new Error(`Sentinel Blocked Trade: ${auth.reason}`);
    }

    // 3. Execute Trade (Only possible with valid auth.signature)
    return await executeTrade(args, auth.signature);
  }
});
```

## 2. EIP-712 & A2A Secure Interoperability
Research into "A2A Secure" (Agent-to-Agent) protocols shows a strong trend toward **EIP-712 signatures** as the standard for verifiable messaging.
- **Benefit:** Our use of EIP-712 makes Vertex Sentinel natively compatible with any agent platform that supports Ethereum wallets (like OpenServ).
- **Security:** It prevents "blind signing" and ensures the agent's intent is cryptographically bound to the specific trade parameters.

## 3. Genkit Modular Risk Engine
The Sentinel SDK should allow developers to "Plug-in" their own risk logic using **Genkit Flows**.

### Modular Plugin Architecture:
The `SentinelClient` will accept a `riskProvider` which is a Genkit flow that satisfies a specific `inputSchema` (TradeIntent) and `outputSchema` (RiskScore).

```typescript
// Conceptual Genkit Plugin
const myCustomRiskFlow = ai.defineFlow(...);

const sentinel = new SentinelClient({
  riskProvider: myCustomRiskFlow, // Pluggable Risk Brain
  // ... other config
});
```

## 4. ERC-8004: Decentralized Identity
To support the "Security SDK" narrative, we will align with **ERC-8004**.
- **Identity Verification:** The `RiskRouter` contract uses ERC-8004 as a fallback to verify if an agent is registered in a global, trustless registry before authorizing trades.
- **Trustless Onboarding:** This allows new agents on OpenServ to immediately use the Sentinel Layer without manual "allowlisting" by us, provided they are registered in the global ERC-8004 registry.

## 5. Conclusion: "Fail-Closed" as a Product
The core value prop of our SDK is the **Fail-Closed** guarantee. If the SDK cannot verify the security of a trade (due to high risk, invalid signature, or expired deadline), the trade *cannot* proceed. This "Hard-Stop" is what differentiates us from simple "Advisory" AI risk tools.
