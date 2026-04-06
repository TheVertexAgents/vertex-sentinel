import { expect } from 'chai';
import sinon from 'sinon';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { analyzeRisk } from '../../../src/logic/strategy/risk_assessment.js';

describe('Risk Assessment Strategy Unit Tests', function () {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should return BUY for standard market parameters', async function () {
    sandbox.stub(Client.prototype, 'connect').resolves();
    sandbox.stub(Client.prototype, 'callTool').resolves({
      content: [{
        type: 'text',
        text: JSON.stringify({
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
        })
      }]
    });

    const decision = await analyzeRisk('BTC/USD', 10000n);
    expect(decision.action).to.equal('BUY');
    expect(decision.confidence).to.be.greaterThan(0.8);
  });

  it('Should return HOLD for high spread', async function () {
    sandbox.stub(Client.prototype, 'connect').resolves();
    sandbox.stub(Client.prototype, 'callTool').resolves({
      content: [{
        type: 'text',
        text: JSON.stringify({
          symbol: 'BTCUSD',
          a: ["51000.0", "1", "1.000"], // ~2% spread
          b: ["49950.0", "1", "1.000"],
          h: ["50050.0", "50100.0"],
          l: ["49950.0", "50000.0"],
          c: ["50000.0", "0.1"],
          v: ["100", "1000"],
          p: ["50000.0", "50000.0"],
          t: [10, 100],
          o: "49900.0"
        })
      }]
    });

    const decision = await analyzeRisk('BTC/USD', 10000n);
    expect(decision.action).to.equal('HOLD');
    expect(decision.reasoning).to.contain('High spread');
    expect(decision.confidence).to.be.lessThanOrEqual(0.8);
  });

  it('Should return HOLD and use fallback in local mode when MCP fails', async function () {
    // Force a connection failure
    sandbox.stub(Client.prototype, 'connect').rejects(new Error('Connection closed'));

    // Ensure we are in local mode for this test
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
