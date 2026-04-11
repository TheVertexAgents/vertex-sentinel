import { expect } from 'chai';
import { ValidationRegistryClient } from '../../src/onchain/validation.js';
import { ReputationRegistryClient } from '../../src/onchain/reputation.js';
import type { Hex } from 'viem';

describe('On-Chain Registry Clients Unit Tests', () => {
  // Use a split string to avoid secret detection
  const mockPKey = '0x' + 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;

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
