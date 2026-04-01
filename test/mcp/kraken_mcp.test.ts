import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import ccxt from 'ccxt';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { KrakenMcpServer } from '../../src/mcp/kraken/index.js';
import { CriticalSecurityException } from '../../src/logic/errors.js';

describe('Kraken MCP Server (TDD)', () => {
  let sandbox: sinon.SinonSandbox;
  let krakenMock: any;
  let server: KrakenMcpServer | null = null;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    krakenMock = {
      fetchTicker: sandbox.stub(),
      fetchBalance: sandbox.stub(),
      createOrder: sandbox.stub(),
    };
    // Mock CCXT constructor
    sandbox.stub(ccxt, 'kraken').returns(krakenMock as any);
    
    // Clear env for tests
    delete process.env.KRAKEN_API_KEY;
    delete process.env.KRAKEN_SECRET;
    delete process.env.GOOGLE_GENAI_API_KEY;
  });

  afterEach(async () => {
    server = null;
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

    const server = new KrakenMcpServer();
    // Access personal server via any cast for testing if protected
    const toolsResult = await (server as any).server.getRequestHandler(ListToolsRequestSchema)(null);
    
    expect(toolsResult.tools).to.be.an('array');
    expect(toolsResult.tools.some((t: any) => t.name === 'get_ticker')).to.be.true;
    expect(toolsResult.tools.some((t: any) => t.name === 'place_order')).to.be.true;
  });

  it('should fetch ticker data correctly', async () => {
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';

    const mockTicker = {
      symbol: 'BTC/USD',
      last: 50000,
      bid: 49990,
      ask: 50010,
    };
    krakenMock.fetchTicker.resolves(mockTicker);
    
    const server = new KrakenMcpServer();
    const result = await (server as any).server.getRequestHandler(CallToolRequestSchema)({
      params: {
        name: 'get_ticker',
        arguments: { symbol: 'BTC/USD' }
      }
    });

    expect(result.content[0].text).to.contain('BTC/USD');
    expect(result.content[0].text).to.contain('50000');
  });

  it('should throw CriticalSecurityException on exchange error', async () => {
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';

    krakenMock.createOrder.rejects(new Error('Insufficient funds'));
    
    const server = new KrakenMcpServer();
    try {
      await (server as any).server.getRequestHandler(CallToolRequestSchema)({
        params: {
          name: 'place_order',
          arguments: { symbol: 'BTC/USD', side: 'buy', type: 'market', amount: 0.1 }
        }
      });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      // Expecting conversion to CriticalSecurityException as per constitution
      // This will fail initially because current implementation throws McpError
      expect(error.name).to.equal('CriticalSecurityException');
    }
  });
});
