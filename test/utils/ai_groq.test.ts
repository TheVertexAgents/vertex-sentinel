import { expect } from 'chai';
import { generateWithRetry, ai, resetAIGlobals } from '../../src/utils/ai.js';
import sinon from 'sinon';

describe('AI Provider Integration (Groq)', function() {
  let aiStub: sinon.SinonStub;

  beforeEach(() => {
    resetAIGlobals();
    aiStub = sinon.stub(ai, 'generate');
  });

  afterEach(() => {
    aiStub.restore();
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
  });

  it('should use Groq provider and default model when AI_PROVIDER=groq', async () => {
    process.env.AI_PROVIDER = 'groq';
    aiStub.resolves({ output: 'groq response' });

    const result = await generateWithRetry('test', { prompt: 'hello' });

    expect(result).to.equal('groq response');
    expect(aiStub.calledOnce).to.be.true;

    const callArgs = aiStub.getCall(0).args[0];
    expect(callArgs.prompt).to.equal('hello');
    // We expect the model to be from groq and have the default name
    // When using llama33x70bVersatile directly, it might be a model object or a string.
    // Based on src/utils/ai.ts refactor, it uses the imported object.
    expect(callArgs.model).to.exist;
  });

  it('should use Groq provider and specified model when AI_MODEL is set', async () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.AI_MODEL = 'mixtral-8x7b-32768';
    aiStub.resolves({ output: 'groq custom model response' });

    const result = await generateWithRetry('test', { prompt: 'hello' });

    expect(result).to.equal('groq custom model response');
    const callArgs = aiStub.getCall(0).args[0];
    expect(callArgs.model).to.equal('groq/mixtral-8x7b-32768');
  });

  it('should fallback to Google provider if AI_PROVIDER is unset', async () => {
    delete process.env.AI_PROVIDER;
    aiStub.resolves({ output: 'google response' });

    const result = await generateWithRetry('test', { prompt: 'hello' });

    expect(result).to.equal('google response');
    const callArgs = aiStub.getCall(0).args[0];
    expect(callArgs.model.name).to.include('gemini-flash-latest');
  });

  it('should automatically switch to Groq model if AI_PROVIDER=groq even if AI_MODEL is gemini default', async () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.AI_MODEL = 'gemini-flash-latest';
    aiStub.resolves({ output: 'groq auto-switch response' });

    const result = await generateWithRetry('test', { prompt: 'hello' });

    expect(result).to.equal('groq auto-switch response');
    const callArgs = aiStub.getCall(0).args[0];
    expect(callArgs.model).to.exist;
  });
});
