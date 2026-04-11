import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';

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
    score: number,
    notes: string,
    privateKey: Hex
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

      const hash = await walletClient.writeContract({
        address: this.registryAddress,
        abi: [
          {
            name: 'postEIP712Attestation',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'agentId', type: 'uint256' },
              { name: 'checkpointHash', type: 'bytes32' },
              { name: 'score', type: 'uint8' },
              { name: 'notes', type: 'string' },
            ],
            outputs: [],
          },
        ],
        functionName: 'postEIP712Attestation',
        args: [agentId, checkpointHash, Math.min(100, Math.max(0, score)), notes],
      });

      // Wait for confirmation to prevent nonce collision with next transaction
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60_000, // 60 second timeout
      });

      console.log(`[validation] ✅ Heartbeat confirmed: ${hash}`);
      return hash;
    } catch (error) {
      console.warn(`[validation] Failed to post attestation: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
