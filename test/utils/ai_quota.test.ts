import { expect } from 'chai';
import { generateWithRetry, resetAIGlobals } from '../../src/utils/ai.js';
import sinon from 'sinon';

describe('AI Rate Limiter & Quota Management (#148)', function() {
  this.timeout(90000); // Wait for rate limiter to reset

  let aiStub: any;

  beforeEach(async () => {
    const aiModule = await import('../../src/utils/ai.js');
    aiStub = sinon.stub(aiModule.ai, 'generate');
    resetAIGlobals();
  });

  afterEach(() => {
    aiStub.restore();
  });

  it('should enforce 10 RPM cap', async () => {
    aiStub.resolves({ output: 'ok' });

    const start = Date.now();
    const promises = [];

    // Send 11 requests. The 11th should be delayed by ~60s
    for (let i = 0; i < 11; i++) {
      promises.push(generateWithRetry('test', { prompt: 'test' }));
    }

    const results = await Promise.all(promises);
    const end = Date.now();

    expect(results.length).to.equal(11);
    expect(end - start).to.be.at.least(60000);
  });

  it('should apply conservative backoff for RESOURCE_EXHAUSTED', async () => {
    aiStub.onFirstCall().rejects(new Error('RESOURCE_EXHAUSTED'));
    aiStub.onSecondCall().resolves({ output: 'success after retry' });

    const start = Date.now();
    const result = await generateWithRetry('test', { prompt: 'test' });
    const end = Date.now();

    expect(result).to.equal('success after retry');
    // First attempt fails, 5s * 2^1 = 10s delay expected
    expect(end - start).to.be.at.least(9000);
  });
});
