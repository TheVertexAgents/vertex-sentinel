import { createWalletClient, createPublicClient, http, fallback, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { loadAgentMetadata } from '../logic/config.js';
import { logger } from '../utils/logger.js';

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

  private getTransport() {
    if (this.chainId === 31337) return http();

    const transports = [];
    if (process.env.INFURA_KEY) {
      transports.push(http(`https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`));
    }
    if (process.env.ALCHEMY_KEY) {
      transports.push(http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`));
    }

    if (transports.length === 0) return http();

    return fallback(transports);
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
      const useCircle = process.env.USE_CIRCLE_WAAS === 'true';
      const chain = this.getChain();
      
      const walletClient = createWalletClient({
        account: useCircle ? undefined : privateKeyToAccount(privateKey),
        chain,
        transport: this.getTransport(),
      });

      const publicClient = createPublicClient({
        chain,
        transport: this.getTransport(),
      });

      const metadata = loadAgentMetadata();

      if (useCircle) {
          // Circle WaaS Activation: Represent heartbeat via USDC nanopayment on Arc L1
          const { CirclePayments } = await import('./circle.js');
          const destinationWallet = process.env.ORCHESTRATOR_WALLET_ADDRESS!;

          const txHash = await CirclePayments.sendPayment({
            destinationWallet,
            amount: "0.001", // Symbolic nanopayment for heartbeat
            invoiceId: `HB-${checkpointHash.substring(0, 12)}`
          });

          logger.info({ module: 'validation', step: 'CIRCLE_HEARTBEAT_ARC_L1', checkpointHash, txHash });
          return txHash as Hex;
      }

      const hash = await walletClient.writeContract({
        address: this.registryAddress,
        account: walletClient.account || (useCircle ? (process.env.AGENT_WALLET_ADDRESS as Hex) : null) as any,
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

      logger.info({ module: 'validation', step: 'HEARTBEAT_CONFIRMED', hash });
      return hash;
    } catch (error) {
      logger.error({ module: 'validation', step: 'ATTESTATION_FAILED', error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}
