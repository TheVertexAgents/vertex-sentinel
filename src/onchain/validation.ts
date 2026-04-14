import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { loadAgentMetadata } from '../logic/config.js';

/**
 * @dev Client for interacting with the ValidationRegistry.
 */
export class ValidationRegistryClient {
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
   * @dev Posts an EIP-712 checkpoint attestation (Heartbeat).
   * Waits for transaction confirmation to prevent nonce collisions.
   */
  async postHeartbeat(
    agentId: bigint,
    checkpointHash: Hex,
    notes: string,
    privateKey: Hex,
    proof: Hex = '0x'
  ): Promise<Hex | null> {
    if (this.registryAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    try {
      const account = privateKeyToAccount(privateKey);
      const chain = this.getChain();
      
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
      });

      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      const metadata = loadAgentMetadata();

      const hash = await walletClient.writeContract({
        address: this.registryAddress,
        abi: [
          {
            name: 'postAttestation',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'agentId', type: 'uint256' },
              { name: 'checkpointHash', type: 'bytes32' },
              { name: 'score', type: 'uint8' },
              { name: 'proofType', type: 'uint8' },
              { name: 'proof', type: 'bytes' },
              { name: 'notes', type: 'string' },
            ],
            outputs: [],
          },
        ],
        functionName: 'postAttestation',
        // Strategically set to config.targetValidationScore.
        // proofType 1 corresponds to EIP-712.
        args: [agentId, checkpointHash, metadata.targetValidationScore, 1, proof, notes],
      });

      // Wait for confirmation to prevent nonce collision with next transaction
      // Reliability Fix (PR #89): Ensure heartbeat is confirmed before trade intent
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: Number(process.env.TX_CONFIRMATION_TIMEOUT) || 90000,
      });

      console.log(`[validation] ✅ Heartbeat confirmed: ${hash}`);
      return hash;
    } catch (error) {
      console.warn(`[validation] Failed to post attestation: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
