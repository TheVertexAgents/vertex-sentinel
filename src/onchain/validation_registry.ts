import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';

/**
 * @dev ValidationRegistry integration layer.
 * Handles posting checkpoint attestations for leaderboard ranking.
 */
export class ValidationRegistryClient {
  private registryAddress: Hex;
  private chainId: number;

  constructor(registryAddress: Hex, chainId: number = 11155111) {
    this.registryAddress = registryAddress;
    this.chainId = chainId;
  }

  private getChain() {
    return this.chainId === 11155111 ? sepolia : hardhat;
  }

  /**
   * @dev Posts a checkpoint attestation to the ValidationRegistry.
   * This is required for the leaderboard to recognize the agent's performance.
   */
  async postCheckpointAttestation(
    agentId: bigint,
    checkpointHash: Hex,
    score: number,
    metadata: string,
    privateKey: Hex
  ): Promise<{ success: boolean; transactionHash?: Hex; error?: string }> {
    try {
      const account = privateKeyToAccount(privateKey);
      const chain = this.getChain();

      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(
          chain.id === 11155111
            ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY || ''}`
            : 'http://127.0.0.1:8545'
        ),
      });

      const VALIDATION_REGISTRY_ABI = [
        {
          name: 'postCheckpointAttestation',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'agentId', type: 'uint256' },
            { name: 'checkpointHash', type: 'bytes32' },
            { name: 'score', type: 'uint256' },
            { name: 'metadata', type: 'string' },
          ],
          outputs: [],
        },
      ] as const;

      const txHash = await walletClient.writeContract({
        address: this.registryAddress,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'postCheckpointAttestation',
        args: [
          agentId,
          checkpointHash,
          BigInt(score),
          metadata,
        ],
      });

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error) {
      // Non-fatal but should be logged
      console.warn(`[validation_registry] Failed to post checkpoint: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
