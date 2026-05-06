import { expect } from 'chai';
import sinon from 'sinon';
import { analyzeRisk } from '../../../src/logic/strategy/risk_assessment.js';
import { KrakenService } from '../../../src/services/kraken_service.js';
import * as aiUtils from '../../../src/utils/ai.js';

describe('Risk Assessment Strategy Unit Tests', function () {
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
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(aiUtils, 'generateWithRetry').resolves({
        headline: "Neutral sentiment",
        indicator: "Neutral",
        score: 0.5,
        riskScore: 0.2,
        marketRisk: 0.2,
        portfolioRisk: 0,
        sentimentRisk: 0.2,
        justification: "Test justification"
    });
  });

  afterEach(async () => {
    sandbox.restore();
    KrakenService.resetInstance();
  });

  it('Should return BUY for standard market parameters', async function () {
    sandbox.stub(KrakenService.prototype, 'getTicker').resolves({
          symbol: 'BTCUSD',
          a: ["50000.0", "1", "1.000"],
          b: ["49950.0", "1", "1.000"],
          h: ["50050.0", "50100.0"],
          l: ["49950.0", "50000.0"],
          c: ["50000.0", "0.1"],
          v: ["100", "1000"],
          p: ["50000.0", "50000.0"],
          t: [10, 100],
          o: "49900.0"
    });
    sandbox.stub(KrakenService.prototype, 'getBalance').resolves({ "USDC": "1000.0" } as any);
    sandbox.stub(KrakenService.prototype, 'getTradeHistory').resolves({ trades: {}, count: 0 } as any);

    const decision = await analyzeRisk('BTC/USD', 10000n);
    expect(decision.action).to.equal('BUY');
    expect(decision.confidence).to.be.greaterThan(0.8);
  });

  it('Should return HOLD for high spread', async function () {
    sandbox.stub(KrakenService.prototype, 'getTicker').resolves({
          symbol: 'BTCUSD',
          a: ["52000.0", "1", "1.000"], // ~4% spread
          b: ["49950.0", "1", "1.000"],
          h: ["50050.0", "50100.0"],
          l: ["49950.0", "50000.0"],
          c: ["50000.0", "0.1"],
          v: ["100", "1000"],
          p: ["50000.0", "50000.0"],
          t: [10, 100],
          o: "49900.0"
    });
    sandbox.stub(KrakenService.prototype, 'getBalance').resolves({ "USDC": "1000.0" } as any);
    sandbox.stub(KrakenService.prototype, 'getTradeHistory').resolves({ trades: {}, count: 0 } as any);

    const decision = await analyzeRisk('BTC/USD', 10000n);
    expect(decision.action).to.equal('HOLD');
    expect(decision.reasoning).to.contain('High spread');
    expect(decision.confidence).to.be.lessThanOrEqual(0.8);
  });

  it('Should return HOLD and use fallback in local mode when KrakenService fails', async function () {
    // Force a connection failure
    sandbox.stub(KrakenService.prototype, 'getTicker').rejects(new Error('Connection closed'));

    // Ensure we are in development mode for this test
    const oldNetwork = process.env.NETWORK;
    process.env.NETWORK = 'development';

    try {
      const decision = await analyzeRisk('BTC/USD', 10000n);
      expect(decision.action).to.equal('HOLD');
      expect(decision.reasoning).to.contain('Fallback');
    } finally {
      process.env.NETWORK = oldNetwork;
    }
  });
});
