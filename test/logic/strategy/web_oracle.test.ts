import { expect } from 'chai';
import sinon from 'sinon';
import { analyzeRisk } from '../../../src/logic/strategy/risk_assessment.js';
import { KrakenService } from '../../../src/services/kraken_service.js';
import { setCachedAI } from '../../../src/utils/ai.js';
import { WebOracleClient } from '../../../src/logic/clients/web_oracle_client.js';

describe('Risk Assessment with Web Oracle Integration', function () {
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
    process.env.WEB_ORACLE_ENABLED = 'true';
  });

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    setCachedAI('sentiment-BTC/USD', {
        headline: "Optimistic market sentiment",
        indicator: "Bullish",
        score: 0.7
    });

    const { AgentStackClient } = await import('../../../src/logic/clients/agent_stack.js');
    sandbox.stub(AgentStackClient, 'verifyTrade').resolves({ verified: true, proof: '0xmockproof' });

    // Stub Kraken
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

    // AI Risk result
    setCachedAI('risk-BTC/USD-10', {
        riskScore: 0.1,
        marketRisk: 0.1,
        portfolioRisk: 0,
        sentimentRisk: 0.1,
        justification: "Low risk"
    });
  });

  afterEach(async () => {
    sandbox.restore();
    KrakenService.resetInstance();
    process.env.WEB_ORACLE_ENABLED = 'true';
  });

  it('Should return HOLD when Web Oracle detects a critical threat', async function () {
    sandbox.stub(WebOracleClient, 'getThreats').resolves({
        critical: true,
        reasoning: 'Critical exploit detected on chain',
        source: 'PeckShield'
    });

    const decision = await analyzeRisk('BTC/USD', 10000n);
    expect(decision.action).to.equal('HOLD');
    expect(decision.riskScore).to.equal(1.0);
    expect(decision.reasoning).to.contain('ORACLE_ALERT');
    expect(decision.reasoning).to.contain('Critical exploit detected on chain');
  });

  it('Should continue with BUY when Web Oracle is disabled', async function () {
    process.env.WEB_ORACLE_ENABLED = 'false';

    sandbox.stub(WebOracleClient, 'getThreats').resolves({
        critical: true,
        reasoning: 'Critical exploit detected',
        source: 'PeckShield'
    });

    const decision = await analyzeRisk('BTC/USD', 10000n);
    expect(decision.action).to.equal('BUY');
    expect(decision.riskScore).to.be.lessThan(0.5);
  });
});
