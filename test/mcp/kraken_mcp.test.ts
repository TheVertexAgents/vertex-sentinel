import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { KrakenMcpServer } from '../../src/mcp/kraken/index.js';
import { CriticalSecurityException } from '../../src/logic/errors.js';

describe('Kraken MCP Server (TDD)', () => {
  let sandbox: sinon.SinonSandbox;
  let executeKrakenCliStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Stub the private method on the prototype before instantiation
    executeKrakenCliStub = sandbox.stub(KrakenMcpServer.prototype as any, 'executeKrakenCli');
    
    // Clear env for tests
    delete process.env.KRAKEN_API_KEY;
    delete process.env.KRAKEN_SECRET;
    delete process.env.GOOGLE_GENAI_API_KEY;
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it('should fail initialization if environment variables are missing', async () => {
    // Current expectation: Fail-Closed principle
    expect(() => new KrakenMcpServer()).to.throw(CriticalSecurityException);
  });

  it('should list available tools correctly', async () => {
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    const server = new KrakenMcpServer();
    const handlers = (server.server as any)._requestHandlers;
    const entry = handlers.get('tools/list');

    const callback = entry.callback || entry;
    const result = await callback({ method: 'tools/list' });
    
    expect(result.tools).to.be.an('array');
    expect(result.tools.some((t: any) => t.name === 'get_ticker')).to.be.true;
    expect(result.tools.some((t: any) => t.name === 'place_order')).to.be.true;
  });

  it('should fetch ticker data correctly via Kraken CLI', async () => {
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    const mockTickerResult = {
      "XXBTZUSD": {
        "a": ["50010.0", "1", "1.000"],
        "b": ["49990.0", "1", "1.000"],
        "c": ["50000.0", "0.1"],
        "v": ["100", "200"],
        "p": ["50000.0", "50000.0"],
        "t": [10, 20],
        "l": ["49000.0", "48000.0"],
        "h": ["51000.0", "52000.0"],
        "o": "49500.0"
      }
    };
    executeKrakenCliStub.returns(mockTickerResult);
    
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
    expect(parsedContent.symbol).to.equal('XXBTZUSD');
    expect(parsedContent.c[0]).to.equal('50000.0');
  });

  it('should throw CriticalSecurityException on exchange error during place_order', async () => {
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    // Simulate CLI error
    executeKrakenCliStub.throws(new Error('Command failed: kraken order ...'));
    
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
      expect(error.message).to.contain('Execution failure on Kraken CLI');
    }
  });

  it('should return InternalError on exchange error during non-sensitive operations', async () => {
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    executeKrakenCliStub.throws(new Error('CLI connection lost'));

    const server = new KrakenMcpServer();
    const handlers = (server.server as any)._requestHandlers;
    const entry = handlers.get('tools/call');
    const callback = entry.callback || entry;

    try {
      await callback({
        method: 'tools/call',
        params: {
          name: 'get_ticker',
          arguments: { symbol: 'BTC/USD' }
        }
      });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).to.contain('Exchange error: CLI connection lost');
    }
  });
});
