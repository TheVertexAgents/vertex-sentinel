import { expect } from 'chai';
import sinon from 'sinon';
import { IdentityClient } from '../../src/onchain/identity.js';

describe('Identity Client Unit Tests', function () {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should correctly check agent registration status', async function () {
    // With zero address, it should now return true (skipping check)
    const client = new IdentityClient('0x0000000000000000000000000000000000000000', 31337);

    const isRegistered = await client.isAgentRegistered('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(isRegistered).to.be.true;
  });

  it('Should return false if registration check fails on a non-zero address', async function () {
    this.timeout(10000); // Increased timeout as we now try multiple methods
    // This address is non-zero, but won't have a contract in the test environment
    const client = new IdentityClient('0x1234567890123456789012345678901234567890', 31337);

    const isRegistered = await client.isAgentRegistered('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(isRegistered).to.be.false;
  });
});
