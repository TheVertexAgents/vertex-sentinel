import { expect } from 'chai';
import nock from 'nock';
import { KrakenMcpServer } from '../../src/mcp/kraken/index.ts';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('Kraken MCP Stability (#148)', function() {
  this.timeout(40000); // Increase mocha timeout for retries
  let server: KrakenMcpServer;

  beforeEach(() => {
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.KRAKEN_PAPER_MODE = 'false';
    server = new KrakenMcpServer();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should retry on ETIMEDOUT and eventually succeed', async () => {
    nock('https://api.kraken.com').get('/0/public/Assets').reply(200, { error: [], result: {} }).persist();
    nock('https://api.kraken.com').get('/0/public/AssetPairs').reply(200, {
        error: [],
        result: {
            "XXBTZUSD": {
                altname: "BTCUSD",
                wsname: "BTC/USD",
                base: "XXBT",
                quote: "ZUSD"
            }
        }
    }).persist();

    // Mock Kraken API to fail twice then succeed
    nock('https://api.kraken.com')
      .get('/0/public/Ticker')
      .query(true)
      .replyWithError({ message: 'ETIMEDOUT', code: 'ETIMEDOUT' });

    nock('https://api.kraken.com')
      .get('/0/public/Ticker')
      .query(true)
      .replyWithError({ message: 'ETIMEDOUT', code: 'ETIMEDOUT' });

    nock('https://api.kraken.com')
      .get('/0/public/Ticker')
      .query(true)
      .reply(200, {
        error: [],
        result: {
          XXBTZUSD: {
            a: ['50000.0', '1', '1.000'],
            b: ['49990.0', '1', '1.000'],
            c: ['49995.0', '0.100'],
            v: ['100.0', '500.0'],
            p: ['49995.0', '49990.0'],
            t: [1000, 5000],
            l: ['49000.0', '48000.0'],
            h: ['51000.0', '52000.0'],
            o: '49500.0'
          }
        }
      });

    const transport = {
        send: (message: any) => {
            if (message.id === '1') {
                transport.resolve(message);
            }
        },
        onclose: () => {},
        onerror: () => {},
        onmessage: () => {},
        start: async () => {},
        resolve: (val: any) => {}
    };

    const responsePromise = new Promise((resolve) => {
        transport.resolve = resolve;
    });

    await (server as any).server.connect(transport);

    await (server as any).server._onrequest({
      jsonrpc: '2.0',
      id: '1',
      method: 'tools/call',
      params: {
        name: 'get_ticker',
        arguments: { symbol: 'BTC/USD' }
      }
    });

    const response: any = await responsePromise;

    if (response.result.isError) {
        throw new Error(response.result.content[0].text);
    }

    expect(response.result.content[0].type).to.equal('text');
    const data = JSON.parse(response.result.content[0].text);
    expect(data.symbol).to.equal('BTC/USD');
  });

  it('should retry on 502 Bad Gateway', async () => {
    nock('https://api.kraken.com').get('/0/public/Assets').reply(200, { error: [], result: {} }).persist();
    nock('https://api.kraken.com').get('/0/public/AssetPairs').reply(200, {
        error: [],
        result: {
            "XXBTZUSD": {
                altname: "BTCUSD",
                wsname: "BTC/USD",
                base: "XXBT",
                quote: "ZUSD"
            }
        }
    }).persist();

    nock('https://api.kraken.com')
      .get('/0/public/Ticker')
      .query(true)
      .reply(502, 'Bad Gateway');

    nock('https://api.kraken.com')
      .get('/0/public/Ticker')
      .query(true)
      .reply(200, {
        error: [],
        result: {
          XXBTZUSD: {
            a: ['50000.0', '1', '1.000'],
            b: ['49990.0', '1', '1.000'],
            c: ['49995.0', '0.100'],
            v: ['100.0', '500.0'],
            p: ['49995.0', '49990.0'],
            t: [1000, 5000],
            l: ['49000.0', '48000.0'],
            h: ['51000.0', '52000.0'],
            o: '49500.0'
          }
        }
      });

    const transport = {
        send: (message: any) => {
            if (message.id === '2') {
                transport.resolve(message);
            }
        },
        onclose: () => {},
        onerror: () => {},
        onmessage: () => {},
        start: async () => {},
        resolve: (val: any) => {}
    };

    const responsePromise = new Promise((resolve) => {
        transport.resolve = resolve;
    });

    await (server as any).server.connect(transport);

    await (server as any).server._onrequest({
      jsonrpc: '2.0',
      id: '2',
      method: 'tools/call',
      params: {
        name: 'get_ticker',
        arguments: { symbol: 'BTC/USD' }
      }
    });

    const response: any = await responsePromise;

    if (response.result.isError) {
        throw new Error(response.result.content[0].text);
    }

    const data = JSON.parse(response.result.content[0].text);
    expect(data.symbol).to.equal('BTC/USD');
  });

  it('should fail after max retries', async () => {
    nock('https://api.kraken.com').get('/0/public/Assets').reply(200, { error: [], result: {} }).persist();
    nock('https://api.kraken.com').get('/0/public/AssetPairs').reply(200, {
        error: [],
        result: {
            "XXBTZUSD": {
                altname: "BTCUSD",
                wsname: "BTC/USD",
                base: "XXBT",
                quote: "ZUSD"
            }
        }
    }).persist();

    nock('https://api.kraken.com')
      .get('/0/public/Ticker')
      .query(true)
      .times(3)
      .reply(503, 'Service Unavailable');

    const transport = {
        send: (message: any) => {
            if (message.id === '3') {
                transport.resolve(message);
            }
        },
        onclose: () => {},
        onerror: () => {},
        onmessage: () => {},
        start: async () => {},
        resolve: (val: any) => {}
    };

    const responsePromise = new Promise((resolve) => {
        transport.resolve = resolve;
    });

    await (server as any).server.connect(transport);

    await (server as any).server._onrequest({
      jsonrpc: '2.0',
      id: '3',
      method: 'tools/call',
      params: {
        name: 'get_ticker',
        arguments: { symbol: 'BTC/USD' }
      }
    });

    const response: any = await responsePromise;
    expect(response.result.isError).to.be.true;
    expect(response.result.content[0].text).to.contain('Exchange error');
  });
});
