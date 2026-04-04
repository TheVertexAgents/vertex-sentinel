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
    expect(decision.riskScore).to.be.lessThan(0.5);
  });

  it('Should return HOLD for high spread', async function () {
    sandbox.stub(Client.prototype, 'connect').resolves();
    sandbox.stub(Client.prototype, 'callTool').resolves({
      content: [{
        type: 'text',
        text: JSON.stringify({
          symbol: 'BTCUSD',
          a: ["51000.0", "1", "1.000"], // 2% spread
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
    expect(decision.reasoning).to.contain('High spread detected');
  });
});
