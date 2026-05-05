import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { safeParseJSON } from '../../src/utils/safe-json.js';
import { logger } from '../../src/utils/logger.js';
import { ERR_JSON_PARSE } from '../../src/utils/constants.js';

describe('safeParseJSON', () => {
  let errorStub: sinon.SinonStub;

  beforeEach(() => {
    errorStub = sinon.stub(logger, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should successfully parse valid JSON', () => {
    const data = '{"key":"value"}';
    const result = safeParseJSON(data, { fallback: true });
    expect(result).to.deep.equal({ key: 'value' });
    expect(errorStub.called).to.be.false;
  });

  it('should return fallback and log error on invalid JSON', () => {
    const data = 'invalid json data';
    const result = safeParseJSON(data, { default: 'fallbackValue' }, { traceId: 'test-trace' });
    
    expect(result).to.deep.equal({ default: 'fallbackValue' });
    expect(errorStub.calledOnce).to.be.true;
    expect(errorStub.firstCall.args[0]).to.include({
      level: 'ERROR',
      module: 'SafeJSON',
      errorCode: ERR_JSON_PARSE,
      traceId: 'test-trace'
    });
  });

  it('should return fallback and log error on empty string', () => {
    const data = '';
    const result = safeParseJSON(data, { empty: true });
    
    expect(result).to.deep.equal({ empty: true });
    expect(errorStub.calledOnce).to.be.true;
    expect(errorStub.firstCall.args[0]).to.include({
      level: 'ERROR',
      module: 'SafeJSON',
      errorCode: ERR_JSON_PARSE,
      rawLength: 0
    });
  });
});
