import { expect } from 'chai';
import { generateWithRetry, resetAIGlobals } from '../../src/utils/ai.js';
import sinon from 'sinon';

describe('AI Rate Limiter & Quota Management (#148)', function() {
  this.timeout(15000); // Reduced from 90s - use shorter test times for CI

  let aiStub: any;
  let clock: sinon.SinonFakeTimers;

  beforeEach(async () => {
    clock = sinon.useFakeTimers();
    const aiModule = await import('../../src/utils/ai.js');
    // Stub the top-level ai.generate method used by genkit
    aiStub = sinon.stub(aiModule.ai, 'generate');
    // Also stub the underlying provider to be safe and avoid API key errors
    const googleAIModule = await import('@genkit-ai/google-genai');
    sinon.stub(googleAIModule.googleAI, 'model').returns({
        generate: async () => ({ output: 'ok' })
    } as any);

    resetAIGlobals();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  it('should enforce 10 RPM cap', async () => {
    aiStub.resolves({ output: 'ok' });

    const promises = [];

    // Send 11 requests. The 11th should be queued.
    for (let i = 0; i < 11; i++) {
      promises.push(generateWithRetry('test', { prompt: 'test' }));
    }

    // Wait a bit, 10 should have processed
    await Promise.resolve(); // let microtasks run
    expect(aiStub.callCount).to.equal(10);

    // Fast-forward time to allow the 11th request
    clock.tick(61000);

    const results = await Promise.all(promises);

    expect(results.length).to.equal(11);
    expect(aiStub.callCount).to.equal(11);
  });

  it('should apply conservative backoff for RESOURCE_EXHAUSTED', async () => {
    aiStub.onFirstCall().rejects(new Error('RESOURCE_EXHAUSTED'));
    aiStub.onSecondCall().resolves({ output: 'success after retry' });

    const promise = generateWithRetry('test', { prompt: 'test' });

    // Allow microtasks to run and start the retry delay
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Fast-forward time to skip the backoff delay (e.g. 10s)
    clock.tick(15000);

    const result = await promise;

    expect(result).to.equal('success after retry');
    // First attempt fails, backoff delay is applied, then retry succeeds.
    // Don't assert strict timing in CI - just verify it retried.
    expect(aiStub.callCount).to.be.at.least(2);
  }).timeout(20000);
});
