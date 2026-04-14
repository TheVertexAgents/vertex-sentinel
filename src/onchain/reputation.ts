import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { logger } from '../utils/logger.js';

/**
 * @dev Client for interacting with the ReputationRegistry.
 */
export class ReputationRegistryClient {
  private registryAddress: Hex;
  private chainId: number;

  constructor(registryAddress: Hex, chainId: number = 11155111) {
    this.registryAddress = registryAddress;
    this.chainId = chainId;
  }

  private getChain() {
    return this.chainId === 31337 ? hardhat : sepolia;
  }

  /**
   * @dev Submits feedback for an agent.
   */
  async submitFeedback(
    agentId: bigint,
    score: number,
    outcomeRef: Hex,
    comment: string,
    privateKey: Hex
  ): Promise<Hex | null> {
    if (this.registryAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    try {
      const account = privateKeyToAccount(privateKey);
      const walletClient = createWalletClient({
        account,
        chain: this.getChain(),
        transport: http(),
      });

      const hash = await walletClient.writeContract({
        address: this.registryAddress,
        abi: [
          {
            name: 'submitFeedback',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'agentId', type: 'uint256' },
              { name: 'score', type: 'uint8' },
              { name: 'outcomeRef', type: 'bytes32' },
              { name: 'comment', type: 'string' },
              { name: 'feedbackType', type: 'uint8' },
            ],
            outputs: [],
          },
        ],
        functionName: 'submitFeedback',
        args: [agentId, score, outcomeRef, comment, 1], // 1 = RISK_MANAGEMENT
      });

      return hash;
    } catch (error) {
      logger.error({ module: 'reputation', step: 'FEEDBACK_FAILED', error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}
