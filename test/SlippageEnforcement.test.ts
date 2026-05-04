import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import ExecutionProxy from '../src/execution/proxy.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Slippage Enforcement Integration', () => {
  let sandbox: sinon.SinonSandbox;
  let mockMcpClient: sinon.SinonStubbedInstance<Client>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mocking the MCP Client
    mockMcpClient = sandbox.createStubInstance(Client);

    // Set environment variables required for ExecutionProxy
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.INFURA_KEY = 'test-infura';
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should calculate and execute correct limit price for BUY orders', async () => {
    const proxy = new ExecutionProxy();
    // Inject the mock MCP client
    (proxy as any).mcpClient = mockMcpClient;

    const tickerData = {
      symbol: 'BTC/USD',
      a: ['50000.0', '1', '1'], // Ask price 50,000
      b: ['49990.0', '1', '1'],
      c: ['50000.0', '1'],
      v: ['100', '100'],
      p: ['50000.0', '50000.0'],
      t: [10, 10],
      l: ['49000.0', '49000.0'],
      h: ['51000.0', '51000.0'],
      o: '49500.0'
    };

    mockMcpClient.callTool.onFirstCall().resolves({
      content: [{ type: 'text', text: JSON.stringify(tickerData) }]
    });

    mockMcpClient.callTool.onSecondCall().resolves({
      content: [{ type: 'text', text: JSON.stringify({ txid: ['ORDER-123'], price: '50500' }) }]
    });

    const pair = 'BTC/USDC';
    const volume = 100000000n; // 1 BTC if usdScalingFactor is 100,000,000?
    // Wait, let's check agent-id.json for usdScalingFactor
    // Actually, I'll just use a bigint and let the proxy handle it.
    const maxSlippageBps = 100n; // 1%

    await proxy.processAuthorizedTrade(pair, volume, 'test-trace-buy', 'buy', maxSlippageBps);

    // Verify ticker was fetched for the correct symbol
    expect(mockMcpClient.callTool.calledWith(sinon.match({
      name: 'get_ticker',
      arguments: { symbol: 'XBTUSD' }
    }))).to.be.true;

    // Verify limit order was placed with correct price
    // Reference Ask: 50,000. Slippage 1% (100bps). Limit Price: 50,000 * 1.01 = 50,500
    expect(mockMcpClient.callTool.calledWith(sinon.match({
      name: 'place_order',
      arguments: {
        symbol: 'XBTUSD',
        side: 'buy',
        type: 'limit',
        amount: sinon.match.number,
        price: 50500
      }
    }))).to.be.true;
  });

  it('should calculate and execute correct limit price for SELL orders', async () => {
    const proxy = new ExecutionProxy();
    (proxy as any).mcpClient = mockMcpClient;

    const tickerData = {
      symbol: 'BTC/USD',
      a: ['50010.0', '1', '1'],
      b: ['50000.0', '1', '1'], // Bid price 50,000
      c: ['50000.0', '1'],
      v: ['100', '100'],
      p: ['50000.0', '50000.0'],
      t: [10, 10],
      l: ['49000.0', '49000.0'],
      h: ['51000.0', '51000.0'],
      o: '49500.0'
    };

    mockMcpClient.callTool.onFirstCall().resolves({
      content: [{ type: 'text', text: JSON.stringify(tickerData) }]
    });

    mockMcpClient.callTool.onSecondCall().resolves({
      content: [{ type: 'text', text: JSON.stringify({ txid: ['ORDER-456'], price: '49500' }) }]
    });

    const pair = 'BTC/USDC';
    const volume = 100000000n;
    const maxSlippageBps = 100n; // 1%

    await proxy.processAuthorizedTrade(pair, volume, 'test-trace-sell', 'sell', maxSlippageBps);

    // Verify limit order was placed with correct price
    // Reference Bid: 50,000. Slippage 1% (100bps). Limit Price: 50,000 * 0.99 = 49,500
    expect(mockMcpClient.callTool.calledWith(sinon.match({
      name: 'place_order',
      arguments: {
        symbol: 'XBTUSD',
        side: 'sell',
        type: 'limit',
        amount: sinon.match.number,
        price: 49500
      }
    }))).to.be.true;
  });

  it('should round limit price to 8 decimal places', async () => {
    const proxy = new ExecutionProxy();
    (proxy as any).mcpClient = mockMcpClient;

    const tickerData = {
      symbol: 'ETH/USD',
      a: ['2345.6789123456', '1', '1'], // High precision price
      b: ['2345.0', '1', '1'],
      c: ['2345.0', '1'],
      v: ['100', '100'],
      p: ['2345.0', '2345.0'],
      t: [10, 10],
      l: ['2300.0', '2300.0'],
      h: ['2400.0', '2400.0'],
      o: '2300.0'
    };

    mockMcpClient.callTool.onFirstCall().resolves({
      content: [{ type: 'text', text: JSON.stringify(tickerData) }]
    });

    mockMcpClient.callTool.onSecondCall().resolves({
      content: [{ type: 'text', text: JSON.stringify({ txid: ['ORDER-789'] }) }]
    });

    const pair = 'ETH/USDC';
    const volume = 100000000n;
    const maxSlippageBps = 5n; // 0.05%

    await proxy.processAuthorizedTrade(pair, volume, 'test-trace-round', 'buy', maxSlippageBps);

    // 2345.6789123456 * 1.0005 = 2346.8517518017728
    // Rounded to 8 decimals: 2346.8517518
    const expectedPrice = 2346.8517518;

    expect(mockMcpClient.callTool.calledWith(sinon.match({
      name: 'place_order',
      arguments: sinon.match.has('price', expectedPrice)
    }))).to.be.true;
  });

  it('should throw CriticalSecurityException for invalid limit price (<= 0)', async () => {
    const proxy = new ExecutionProxy();
    (proxy as any).mcpClient = mockMcpClient;

    const tickerData = {
      symbol: 'BTC/USD',
      a: ['0', '1', '1'], // Invalid price from exchange
      b: ['0', '1', '1'],
      c: ['0', '1'],
      v: ['100', '100'],
      p: ['0', '0'],
      t: [10, 10],
      l: ['0', '0'],
      h: ['0', '0'],
      o: '0'
    };

    mockMcpClient.callTool.resolves({
      content: [{ type: 'text', text: JSON.stringify(tickerData) }]
    });

    const pair = 'BTC/USDC';
    const volume = 100000000n;
    const maxSlippageBps = 100n;

    try {
      await proxy.processAuthorizedTrade(pair, volume, 'test-trace-invalid', 'buy', maxSlippageBps);
      expect.fail('Should have thrown CriticalSecurityException');
    } catch (error: any) {
      expect(error.name).to.equal('CriticalSecurityException');
      expect(error.message).to.contain('Invalid calculated limitPrice');
    }
  });
});
