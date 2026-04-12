import { expect } from 'chai';
import { ValidationRegistryClient } from '../../src/onchain/validation.js';
import { ReputationRegistryClient } from '../../src/onchain/reputation.js';
import type { Hex } from 'viem';

describe('On-Chain Registry Clients Unit Tests', () => {
  // Use a completely fake key to avoid any entropy-based detection
  const mockPKey = '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex;

  it('ValidationRegistryClient should handle zero address gracefully', async () => {
    const client = new ValidationRegistryClient('0x0000000000000000000000000000000000000000', 31337);
    const result = await client.postHeartbeat(1n, '0xabc' as Hex, 'test', mockPKey);
    expect(result).to.be.null;
  });

  it('ReputationRegistryClient should handle zero address gracefully', async () => {
    const client = new ReputationRegistryClient('0x0000000000000000000000000000000000000000', 31337);
    const result = await client.submitFeedback(1n, 100, '0xabc' as Hex, 'test', mockPKey);
    expect(result).to.be.null;
  });
});
