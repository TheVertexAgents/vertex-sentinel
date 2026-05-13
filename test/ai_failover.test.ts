import { expect } from 'chai';
import sinon from 'sinon';
import { getAIResponse, ai } from '../src/utils/ai.js';
import { logger } from '../src/utils/logger.js';

describe('AI Provider Failover', function() {
  let aiStub: sinon.SinonStub;
  let warnStub: sinon.SinonStub;

  beforeEach(() => {
    aiStub = sinon.stub(ai, 'generate');
    warnStub = sinon.stub(logger, 'warn');
  });

  afterEach(() => {
    aiStub.restore();
    warnStub.restore();
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
  });

  it('should fall back to groq when google fails and log a warning', async function() {
    process.env.AI_PROVIDER = 'google';

    let callCount = 0;
    aiStub.callsFake(async () => {
      callCount++;
      if (callCount === 1) {
        // Simulate Google provider error (500)
        throw new Error('500 Internal Server Error');
      }
      // Simulate Groq success on fallback
      return { output: 'groq response' };
    });

    const result = await getAIResponse('AI_FAILOVER_TEST', { prompt: 'hello' }, 1);

    expect(result).to.equal('groq response');
    expect(aiStub.callCount).to.equal(2);
    expect(warnStub.called).to.be.true;

    // Ensure a PRIMARY_FAILED warning was emitted
    const primaryFailed = warnStub.getCalls().some(c => c.args[0] && c.args[0].step === 'PRIMARY_FAILED');
    expect(primaryFailed).to.equal(true);
  });
});
