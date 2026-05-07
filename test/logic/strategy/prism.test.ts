import { expect } from 'chai';
import sinon from 'sinon';
import { getAssetResolution } from '../../../src/logic/strategy/prism.js';

describe('Prism Asset Resolution', () => {
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    fetchStub = sinon.stub(global, 'fetch');
    process.env.STRYKR_PRISM_API = 'test-api-key';
  });

  afterEach(() => {
    fetchStub.restore();
  });

  it('should resolve a valid pair successfully', async () => {
    const mockResponse = { symbol: 'XXBTZUSD', precision: 10 };
    fetchStub.resolves({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getAssetResolution('BTC/USD');

    expect(result).to.deep.equal(mockResponse);
    expect(fetchStub.calledOnce).to.be.true;
    const url = fetchStub.firstCall.args[0];
    expect(url).to.contain('pair=BTC%2FUSD');
  });

  it('should fallback on schema validation failure', async () => {
    const invalidResponse = { symbol: 'XXBTZUSD' }; // Missing precision
    fetchStub.resolves({
      ok: true,
      json: async () => invalidResponse,
    });

    const result = await getAssetResolution('BTC/USD');

    expect(result.symbol).to.equal('BTC/USD');
    expect(result.precision).to.equal(18);
  });

  it('should fallback on API error (500)', async () => {
    fetchStub.resolves({
      ok: false,
      status: 500,
    });

    const result = await getAssetResolution('ETH/USD');

    expect(result.symbol).to.equal('ETH/USD');
    expect(result.precision).to.equal(18);
  });

  it('should fallback on timeout', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'TimeoutError';
    fetchStub.rejects(timeoutError);

    const result = await getAssetResolution('SOL/USD');

    expect(result.symbol).to.equal('SOL/USD');
    expect(result.precision).to.equal(18);
  });

  it('should normalize legacy XBTUSD symbol', async () => {
    fetchStub.resolves({
      ok: false,
      status: 404,
    });

    const result = await getAssetResolution('XBTUSD');

    expect(result.symbol).to.equal('BTC/USD');
    expect(result.precision).to.equal(18);
  });
});
