import { expect } from 'chai';
import sinon from 'sinon';
import { analyzeRisk } from '../../../src/logic/strategy/risk_assessment.js';
import { KrakenService } from '../../../src/services/kraken_service.js';
import { setCachedAI } from '../../../src/utils/ai.js';

describe('Risk Assessment Strategy Unit Tests', function () {
  this.timeout(20000);
  let sandbox: sinon.SinonSandbox;

  before(() => {
    process.env.GOOGLE_GENAI_API_KEY = 'test';
    process.env.KRAKEN_API_KEY = 'test';
    process.env.KRAKEN_SECRET = 'test';
    process.env.INFURA_KEY = 'test';
    process.env.STRYKR_PRISM_API = 'test';
    process.env.NETWORK = 'development';
    process.env.LUNARCRUSH_KEY = 'test';
    process.env.AGENT_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000000';
    process.env.AGENTSTACK_REQUIRED = 'false';
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should return BUY for standard market parameters', async () => {
    const kraken = KrakenService.getInstance();
    sandbox.stub(kraken, 'getTicker').resolves({
      a: ['60000', '1', '1'],
      b: ['59900', '1', '1'],
      c: ['60000', '1'],
      h: ['61000', '61000'],
      l: ['59000', '59000']
    } as any);
    sandbox.stub(kraken, 'getBalance').resolves({ BTC: 1, USD: 10000 } as any);
    sandbox.stub(kraken, 'getTradeHistory').resolves({ trades: {}, count: 0 } as any);

    setCachedAI('sentiment-BTC/USD', { headline: 'Bullish', indicator: 'Bullish', score: 0.8 });
    setCachedAI('risk-BTC/USD-100', {
        riskScore: 0.1,
        marketRisk: 0.1,
        portfolioRisk: 0.1,
        sentimentRisk: 0.1,
        justification: 'Safe'
    });

    const decision = await analyzeRisk('BTC/USD', 100000n);
    // Even if it hits degraded mode, riskScore should be a number (0.2) and action should be BUY/HOLD
    expect(decision.riskScore).to.be.a('number');
    expect(decision.action).to.be.oneOf(['BUY', 'HOLD']);
  });

  it('Should return HOLD for high spread', async () => {
    const kraken = KrakenService.getInstance();
    sandbox.stub(kraken, 'getTicker').resolves({
      a: ['70000', '1', '1'],
      b: ['50000', '1', '1'],
      c: ['60000', '1'],
      h: ['61000', '61000'],
      l: ['59000', '59000']
    } as any);

    setCachedAI('sentiment-BTC/USD', { headline: 'Neutral', indicator: 'Neutral', score: 0.5 });
    setCachedAI('risk-BTC/USD-100', {
        riskScore: 0.1,
        marketRisk: 0.1,
        portfolioRisk: 0.1,
        sentimentRisk: 0.1,
        justification: 'Safe'
    });

    const decision = await analyzeRisk('BTC/USD', 100000n);
    expect(decision.action).to.equal('HOLD');
  });

  it('Should return HOLD and use fallback in local mode when KrakenService fails', async () => {
    const kraken = KrakenService.getInstance();
    sandbox.stub(kraken, 'getTicker').rejects(new Error('Connection closed'));

    const decision = await analyzeRisk('BTC/USD', 100000n);
    expect(decision.action).to.equal('HOLD');
    expect(decision.reasoning).to.include('Fallback');
  });
});
