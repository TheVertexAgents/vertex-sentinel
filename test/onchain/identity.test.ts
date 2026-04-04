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
    // We can't easily mock createPublicClient as it's an export from viem
    // But we can test the fallback/error handling of the Client
    const client = new IdentityClient('0x0000000000000000000000000000000000000000');

    // This will trigger a network error in test environment (no RPC)
    // but the Client is designed to log a warning and return false
    const isRegistered = await client.isAgentRegistered('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(isRegistered).to.be.false;
  });
});
