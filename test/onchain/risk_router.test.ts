import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { RiskRouterClient } from '../../src/onchain/risk_router.js';
import type { TradeIntent } from '../../src/logic/types.js';

use(chaiAsPromised);

describe('Risk Router Client Unit Tests', () => {
  let client: RiskRouterClient;
  const routerAddress = '0x1234567890123456789012345678901234567890';
  const privateKey = '0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1' as `0x${string}`;

  beforeEach(() => {
    client = new RiskRouterClient(routerAddress, 31337);
  });

  it('should compute an intent hash correctly', () => {
    const intent: TradeIntent = {
      agentId: 1n,
      agentWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      pair: 'BTC/USDC',
      action: 'BUY',
      amountUsdScaled: 10000n,
      maxSlippageBps: 50n,
      nonce: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };

    const hash = client.computeIntentHash(intent);
    expect(hash).to.match(/^0x[a-f0-9]{64}$/);
  });

  it('should sign an intent with EIP-712', async () => {
    const intent: TradeIntent = {
      agentId: 1n,
      agentWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      pair: 'BTC/USDC',
      action: 'BUY',
      amountUsdScaled: 10000n,
      maxSlippageBps: 50n,
      nonce: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };

    const signature = await client.signIntent(intent, privateKey);
    expect(signature).to.match(/^0x[a-f0-9]{130}$/);
  });

  it('should throw CriticalSecurityException if signing fails', async () => {
    const intent: any = null;
    await expect(client.signIntent(intent, privateKey)).to.be.rejectedWith('Fail-Closed: RiskRouter signing failed');
  });
});
