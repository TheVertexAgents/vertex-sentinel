import { expect } from 'chai';
import sinon from 'sinon';
import { IdentityClient } from '../../src/onchain/identity.js';
import { CriticalSecurityException } from '../../src/logic/errors.js';

describe('Identity Client Unit Tests', function () {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should throw CriticalSecurityException if registry address is uninitialized (zero address)', async function () {
    const client = new IdentityClient('0x0000000000000000000000000000000000000000', 31337);

    try {
      await client.isAgentRegistered('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect.fail('Should have thrown CriticalSecurityException');
    } catch (error: any) {
      expect(error).to.be.instanceOf(CriticalSecurityException);
      expect(error.message).to.contain('uninitialized');
    }
  });

  it('Should throw CriticalSecurityException if registration check fails on a non-zero address', async function () {
    this.timeout(10000);
    // This address is non-zero, but won't have a contract in the test environment
    const client = new IdentityClient('0x1234567890123456789012345678901234567890', 31337);

    try {
      await client.isAgentRegistered('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect.fail('Should have thrown CriticalSecurityException');
    } catch (error: any) {
      expect(error).to.be.instanceOf(CriticalSecurityException);
      expect(error.message).to.contain('Registration check failed');
    }
  });
});
