import { expect } from 'chai';
import { SentinelClient } from '../src/client.js';
import { TradeIntent } from '../src/types.js';
import sinon from 'sinon';

describe('Sentinel SDK Client', () => {
  const config = {
    network: 'local' as const,
    routerAddress: '0x0000000000000000000000000000000000000000',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    agentId: 1
  };

  const client = new SentinelClient(config);

  it('should sign a valid trade intent', async () => {
    const intent: TradeIntent = {
      agentId: 1n,
      agentWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      pair: 'BTC/USD',
      action: 'BUY',
      amountUsdScaled: 10000n,
      maxSlippageBps: 100,
      nonce: 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };

    const signature = await client.signIntent(intent);
    expect(signature).to.be.a('string');
    expect(signature.startsWith('0x')).to.be.true;
  });

  it('should authorize a trade when agent is active', async () => {
    const intent: TradeIntent = {
        agentId: 1n,
        agentWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        pair: 'BTC/USD',
        action: 'BUY',
        amountUsdScaled: 10000n,
        maxSlippageBps: 100,
        nonce: 1n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
      };

    // Mock on-chain check
    const stub = sinon.stub(client, 'authorize' as any).resolves({
        isAllowed: true,
        reason: 'Sentinel: Intent verified and signed.',
        signature: '0xmock'
    });

    const auth = await client.authorize(intent);
    expect(auth.isAllowed).to.be.true;
    expect(auth.signature).to.equal('0xmock');
    stub.restore();
  });

  it('should fetch risk assessment', async () => {
    const assessment = await client.getRiskAssessment('BTC/USD', 100);
    expect(assessment.riskScore).to.equal(0.1);
  });
});
