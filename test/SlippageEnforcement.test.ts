import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import ExecutionProxy from '../src/execution/proxy.js';
import { orderManager } from '../src/execution/order-manager.js';

describe('Slippage Enforcement Integration', () => {
  let sandbox: sinon.SinonSandbox;
  let fetchTickerStub: sinon.SinonStub;
  let placeLimitOrderStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Set environment variables required for ExecutionProxy
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.INFURA_KEY = 'test-infura';

    const adapter = orderManager.getBinanceAdapter();
    fetchTickerStub = sandbox.stub(adapter, 'fetchTicker');
    placeLimitOrderStub = sandbox.stub(orderManager, 'placeLimitOrder');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should calculate and execute correct limit price for BUY orders', async () => {
    const proxy = new ExecutionProxy();

    fetchTickerStub.resolves({
        ask: 50000,
        bid: 49990,
        symbol: 'BTCUSDC'
    });

    placeLimitOrderStub.resolves({ id: 'ORDER-123', price: 50500 });

    const pair = 'BTC/USDC';
    const volume = 100000000n;
    const maxSlippageBps = 100n; // 1%

    await proxy.processAuthorizedTrade(pair, volume, 'test-trace-buy', 'buy', maxSlippageBps);

    // Verify ticker was fetched for the correct symbol
    expect(fetchTickerStub.calledWith('BTCUSDC')).to.be.true;

    // Verify limit order was placed with correct price
    // Reference Ask: 50,000. Slippage 1% (100bps). Limit Price: 50,000 * 1.01 = 50,500
    expect(placeLimitOrderStub.calledWith('BTCUSDC', 'BUY', sinon.match.number, 50500)).to.be.true;
  });

  it('should calculate and execute correct limit price for SELL orders', async () => {
    const proxy = new ExecutionProxy();

    fetchTickerStub.resolves({
        ask: 50010,
        bid: 50000,
        symbol: 'BTCUSDC'
    });

    placeLimitOrderStub.resolves({ id: 'ORDER-456', price: 49500 });

    const pair = 'BTC/USDC';
    const volume = 100000000n;
    const maxSlippageBps = 100n; // 1%

    await proxy.processAuthorizedTrade(pair, volume, 'test-trace-sell', 'sell', maxSlippageBps);

    // Verify limit order was placed with correct price
    // Reference Bid: 50,000. Slippage 1% (100bps). Limit Price: 50,000 * 0.99 = 49,500
    expect(placeLimitOrderStub.calledWith('BTCUSDC', 'SELL', sinon.match.number, 49500)).to.be.true;
  });

  it('should round limit price to 8 decimal places', async () => {
    const proxy = new ExecutionProxy();

    fetchTickerStub.resolves({
        ask: 2345.6789123456,
        bid: 2345.0,
        symbol: 'ETHUSDC'
    });

    placeLimitOrderStub.resolves({ id: 'ORDER-789', price: 2346.8517518 });

    const pair = 'ETH/USDC';
    const volume = 100000000n;
    const maxSlippageBps = 5n; // 0.05%

    await proxy.processAuthorizedTrade(pair, volume, 'test-trace-round', 'buy', maxSlippageBps);

    // 2345.6789123456 * 1.0005 = 2346.8517518017728
    // Rounded to 8 decimals: 2346.8517518
    const expectedPrice = 2346.8517518;

    expect(placeLimitOrderStub.calledWith('ETHUSDC', 'BUY', sinon.match.number, expectedPrice)).to.be.true;
  });

  it('should throw CriticalSecurityException for invalid ticker data', async () => {
    const proxy = new ExecutionProxy();

    fetchTickerStub.resolves({
        ask: 0,
        bid: 0,
        symbol: 'BTCUSDC'
    });

    const pair = 'BTC/USDC';
    const volume = 100000000n;
    const maxSlippageBps = 100n;

    try {
      await proxy.processAuthorizedTrade(pair, volume, 'test-trace-invalid', 'buy', maxSlippageBps);
      expect.fail('Should have thrown CriticalSecurityException');
    } catch (error: any) {
      expect(error.name).to.equal('CriticalSecurityException');
      expect(error.message).to.contain('Invalid or missing ticker data');
    }
  });
});
