import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { KrakenMcpServer } from '../../src/mcp/kraken/index.js';
import { CriticalSecurityException } from '../../src/logic/errors.js';
import { kraken as KrakenExchange } from 'ccxt';

describe('Kraken MCP Server (TDD)', () => {
  let sandbox: sinon.SinonSandbox;
  let fetchTickerStub: sinon.SinonStub;
  let createOrderStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Stub the CCXT methods on the prototype (#144 migration)
    fetchTickerStub = sandbox.stub(KrakenExchange.prototype, 'fetchTicker');
    createOrderStub = sandbox.stub(KrakenExchange.prototype, 'createOrder');
    
    // Clear env for tests
    delete process.env.KRAKEN_API_KEY;
    delete process.env.KRAKEN_SECRET;
    delete process.env.GOOGLE_GENAI_API_KEY;
    delete process.env.INFURA_KEY;
    delete process.env.STRYKR_PRISM_API;
    delete process.env.NETWORK;
    delete process.env.LUNARCRUSH_KEY;
    process.env.KRAKEN_PAPER_MODE = 'false';
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it('should fail initialization if environment variables are missing', async () => {
    // Current expectation: Fail-Closed principle
    expect(() => new KrakenMcpServer()).to.throw(CriticalSecurityException);
  });

  it('should list available tools correctly', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.INFURA_KEY = 'test-infura';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.STRYKR_PRISM_API = 'test-prism-key';
    process.env.NETWORK = 'local';
    process.env.LUNARCRUSH_KEY = 'test-lunar';

    const server = new KrakenMcpServer();
    const handlers = (server.server as any)._requestHandlers;
    const entry = handlers.get('tools/list');

    const callback = entry.callback || entry;
    const result = await callback({ method: 'tools/list' });
    
    expect(result.tools).to.be.an('array');
    expect(result.tools.some((t: any) => t.name === 'get_ticker')).to.be.true;
    expect(result.tools.some((t: any) => t.name === 'place_order')).to.be.true;
  });

  it('should fetch ticker data correctly via CCXT', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.INFURA_KEY = 'test-infura';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.STRYKR_PRISM_API = 'test-prism-key';
    process.env.NETWORK = 'local';
    process.env.LUNARCRUSH_KEY = 'test-lunar';

    const mockCCXTResult = {
      symbol: 'BTC/USD',
      ask: 50010.0,
      bid: 49990.0,
      last: 50000.0,
      baseVolume: 100,
      vwap: 50000.0,
      count: 10,
      low: 49000.0,
      high: 51000.0,
      open: 49500.0
    };
    fetchTickerStub.resolves(mockCCXTResult);
    
    const server = new KrakenMcpServer();
    const handlers = (server.server as any)._requestHandlers;
    const entry = handlers.get('tools/call');
    const callback = entry.callback || entry;

    const result = await callback({
      method: 'tools/call',
      params: {
        name: 'get_ticker',
        arguments: { symbol: 'BTC/USD' }
      }
    });

    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent.symbol).to.equal('BTC/USD');
    expect(parsedContent.c[0]).to.equal('50000');
  });

  it('should throw CriticalSecurityException on exchange error during place_order', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.INFURA_KEY = 'test-infura';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.STRYKR_PRISM_API = 'test-prism-key';
    process.env.NETWORK = 'local';
    process.env.LUNARCRUSH_KEY = 'test-lunar';

    // Simulate CCXT error
    createOrderStub.rejects(new Error('CCXT: Insufficient funds'));
    
    const server = new KrakenMcpServer();
    const handlers = (server.server as any)._requestHandlers;
    const entry = handlers.get('tools/call');
    const callback = entry.callback || entry;

    try {
      await callback({
        method: 'tools/call',
        params: {
          name: 'place_order',
          arguments: { symbol: 'BTC/USD', side: 'buy', type: 'market', amount: 0.1 }
        }
      });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.name).to.equal('CriticalSecurityException');
      expect(error.message).to.contain('Execution failure on Kraken API');
    }
  });

  it('should return MCP error response on exchange error during non-sensitive operations', async () => {
    process.env.AI_PROVIDER = 'google';
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.INFURA_KEY = 'test-infura';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.STRYKR_PRISM_API = 'test-prism-key';
    process.env.NETWORK = 'local';
    process.env.LUNARCRUSH_KEY = 'test-lunar';

    fetchTickerStub.rejects(new Error('CCXT: connection lost'));

    const server = new KrakenMcpServer();
    const handlers = (server.server as any)._requestHandlers;
    const entry = handlers.get('tools/call');
    const callback = entry.callback || entry;

    // Non-sensitive tools now return { isError: true } instead of throwing,
    // allowing the LLM to see the error and decide to retry gracefully.
    const result = await callback({
      method: 'tools/call',
      params: {
        name: 'get_ticker',
        arguments: { symbol: 'BTC/USD' }
      }
    });

    expect(result.isError).to.be.true;
    expect(result.content).to.be.an('array');
    expect(result.content[0].type).to.equal('text');
    expect(result.content[0].text).to.contain('Exchange error: CCXT: connection lost');
  });
});
