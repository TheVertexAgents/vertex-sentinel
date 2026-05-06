import { expect } from 'chai';
import sinon from 'sinon';
import { analyzeRisk } from '../../../src/logic/strategy/risk_assessment.js';
import { KrakenService } from '../../../src/services/kraken_service.js';
import { setCachedAI } from '../../../src/utils/ai.js';

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

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Default: seed bullish sentiment to bypass ROI block (0.7 > spread)
    setCachedAI('sentiment-BTC/USD', {
        headline: "Optimistic market sentiment",
        indicator: "Bullish",
        score: 0.7
    });

    // Mock AgentStackClient to pass "Verified or Die" security check globally for tests
    const { AgentStackClient } = await import('../../../src/logic/clients/agent_stack.js');
    sandbox.stub(AgentStackClient, 'verifyTrade').resolves({ verified: true, proof: '0xmockproof' });
  });

  afterEach(async () => {
    sandbox.restore();
    KrakenService.resetInstance();
  });

  it('Should return BUY for standard market parameters', async function () {
    // Seed low-risk AI result: riskScore=0.05 → confidence=0.95 → BUY
    // Cache key: risk-BTC/USD-10 (amountUsd = 10000/100 = 100, floor(100/10) = 10)
    setCachedAI('risk-BTC/USD-10', {
        riskScore: 0.05,
        marketRisk: 0.05,
        portfolioRisk: 0,
        sentimentRisk: 0.05,
        justification: "Low risk test justification"
    });

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
    // Seed high-risk AI result: riskScore=0.9 → confidence=0.1 → HOLD
    setCachedAI('risk-BTC/USD-10', {
        riskScore: 0.9,
        marketRisk: 0.8,
        portfolioRisk: 0.3,
        sentimentRisk: 0.5,
        justification: "High risk due to extreme spread and volatility"
    });

    sandbox.stub(KrakenService.prototype, 'getTicker').resolves({
          symbol: 'BTCUSD',
          a: ["52000.0", "1", "1.000"], // ~4% spread
          b: ["49950.0", "1", "1.000"],
          h: ["55000.0", "55000.0"],    // High volatility
          l: ["49500.0", "49500.0"],
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
    expect(decision.riskScore).to.be.greaterThan(0.8);
    expect(decision.confidence).to.be.lessThanOrEqual(0.2);
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

