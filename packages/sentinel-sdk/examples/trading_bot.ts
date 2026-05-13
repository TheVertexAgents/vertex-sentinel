import { SentinelClient } from '../src/client.js';
import {
  InsufficientCollateralError,
  StalePriceError,
  FailClosedException,
  InsufficientQuotaError
} from '../src/errors';

async function run() {
  const DRY_RUN = (process.env.DRY_RUN || 'true') === 'true';
  const NANOPAYMENT_USDC = 0.001; // Corrected nanopayment value: 0.001 USDC

  const sentinel = new SentinelClient({
    network: 'sepolia',
    routerAddress: process.env.ROUTER_ADDRESS || '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC',
    privateKey: process.env.AGENT_PRIVATE_KEY,
    agentId: 1
  });

  const intent = {
    agentId: 1n,
    agentWallet: process.env.AGENT_WALLET || '0x...',
    pair: 'BTC/USD',
    action: 'BUY',
    amountUsdScaled: 100000n,
    maxSlippageBps: 100,
    nonce: 1n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
  };

  console.log(`Nanopayment configured: ${NANOPAYMENT_USDC} USDC`);

  try {
    if (DRY_RUN) {
      console.log('DRY_RUN enabled — simulating Sentinel authorization.');
      // Simulate core logic: signIntent (no network calls)
      try {
        // Use a dummy intent for signing if private key provided
        if (process.env.AGENT_PRIVATE_KEY) {
          const sig = await sentinel.signIntent(intent as any);
          console.log('Simulated signature:', sig.slice(0, 12) + '...');
        } else {
          console.log('No private key provided — skipping signing simulation.');
        }
        console.log('Simulated authorization: ALLOWED');
      } catch (e: any) {
        console.warn('Simulated signing failed (expected in env-missing cases):', e.message);
      }

      return;
    }

    const auth = await sentinel.authorize(intent);
    if (auth.isAllowed) {
      console.log('Authorized — signature:', auth.signature);
      // Proceed with execution using auth.signature
    } else {
      console.error('Sentinel rejected intent:', auth.reason);
    }
  } catch (err: any) {
    if (err instanceof InsufficientCollateralError) {
      console.error('Collateral issue:', err.message);
    } else if (err instanceof StalePriceError) {
      console.error('Price feed issue:', err.message);
    } else if (err instanceof InsufficientQuotaError) {
      console.error('AI quota exhausted — reduce frequency or upgrade plan');
    } else if (err instanceof FailClosedException) {
      console.error('Fail-closed triggered — manual intervention required');
    } else {
      console.error('Unexpected error authorizing with Sentinel:', err?.message || err);
    }
  }
}

// Execute when run as a script
run().catch(e => console.error(e));
