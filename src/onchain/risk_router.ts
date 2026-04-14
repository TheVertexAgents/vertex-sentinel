import { createWalletClient, createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';
import type { TradeIntent } from '../logic/types.js';
import { logger } from '../utils/logger.js';

/**
 * @dev RiskRouter integration layer.
 * Handles building, signing, and submitting TradeIntents.
 */
export class RiskRouterClient {
  private routerAddress: Hex;
  private chainId: number;

  constructor(routerAddress: Hex, chainId: number = 11155111) {
    this.routerAddress = routerAddress;
    this.chainId = chainId;
  }

  private getChain() {
    return this.chainId === 31337 ? hardhat : sepolia;
  }

  /**
   * @dev Builds EIP-712 domain and types for RiskRouter.
   * Aligned with strengthened RiskRouter.sol.
   */
  private getTypedData() {
    return {
      domain: {
        name: 'VertexAgents-Sentinel',
        version: '1',
        chainId: this.chainId,
        verifyingContract: this.routerAddress,
      },
      types: {
        TradeIntent: [
          { name: 'agentId', type: 'uint256' },
          { name: 'agentWallet', type: 'address' },
          { name: 'pair', type: 'string' },
          { name: 'action', type: 'string' },
          { name: 'amountUsdScaled', type: 'uint256' },
          { name: 'maxSlippageBps', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    };
  }

  /**
   * @dev Fetches the current nonce for an agent from RiskRouter.
   */
  async getIntentNonce(agentId: bigint): Promise<bigint> {
    if (this.routerAddress === '0x0000000000000000000000000000000000000000') {
      throw new CriticalSecurityException('Fail-Closed: RiskRouter address is uninitialized (zero address)');
    }

    try {
      const publicClient = createPublicClient({
        chain: this.getChain(),
        transport: http(),
      });

      const nonce = await publicClient.readContract({
        address: this.routerAddress,
        abi: [
          {
            name: 'getIntentNonce',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'agentId', type: 'uint256' }],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'getIntentNonce',
        args: [agentId],
      });

      return nonce as bigint;
    } catch (error) {
      if (error instanceof CriticalSecurityException) throw error;
      throw new CriticalSecurityException(`Fail-Closed: Failed to fetch nonce: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * @dev Signs a TradeIntent using EIP-712.
   */
  async signIntent(intent: TradeIntent, privateKey: Hex): Promise<Hex> {
    try {
      const account = privateKeyToAccount(privateKey);
      const client = createWalletClient({
        account,
        chain: this.getChain(),
        transport: http(),
      });

      const { domain, types } = this.getTypedData();

      const signature = await client.signTypedData({
        domain,
        types,
        primaryType: 'TradeIntent',
        message: {
          agentId: BigInt(intent.agentId),
          agentWallet: intent.agentWallet as Hex,
          pair: intent.pair,
          action: intent.action,
          amountUsdScaled: BigInt(intent.amountUsdScaled),
          maxSlippageBps: BigInt(intent.maxSlippageBps),
          nonce: BigInt(intent.nonce),
          deadline: BigInt(intent.deadline),
        },
      });

      return signature;
    } catch (error) {
      throw new CriticalSecurityException(`Fail-Closed: RiskRouter signing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * @dev Computes the intent hash for auditing and on-chain correlation.
   */
  computeIntentHash(intent: TradeIntent): Hex {
    const encoded = encodeAbiParameters(
      parseAbiParameters('uint256, address, string, string, uint256, uint256'),
      [
        BigInt(intent.agentId),
        intent.agentWallet as Hex,
        intent.pair,
        intent.action,
        BigInt(intent.amountUsdScaled),
        BigInt(intent.nonce)
      ]
    );
    return keccak256(encoded);
  }

  /**
   * @dev Submits a signed trade intent to RiskRouter for on-chain validation.
   */
  async authorizeTrade(
    intent: TradeIntent,
    signature: Hex,
    privateKey: Hex
  ): Promise<{ success: boolean; transactionHash?: Hex; error?: string }> {
    // Fail-Closed: Remove zero-address and DEMO_MODE guards.
    if (this.routerAddress === '0x0000000000000000000000000000000000000000') {
        throw new CriticalSecurityException('Fail-Closed: RiskRouter address is uninitialized (zero address)');
    }

    try {
      const account = privateKeyToAccount(privateKey);
      const chain = this.getChain();

      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
      });

      const RISK_ROUTER_ABI = [
        {
          type: 'function',
          name: 'submitTradeIntent',
          inputs: [
            {
              name: 'intent',
              type: 'tuple',
              components: [
                { name: 'agentId', type: 'uint256' },
                { name: 'agentWallet', type: 'address' },
                { name: 'pair', type: 'string' },
                { name: 'action', type: 'string' },
                { name: 'amountUsdScaled', type: 'uint256' },
                { name: 'maxSlippageBps', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
              ],
            },
            { name: 'signature', type: 'bytes' },
          ],
          outputs: [
            { name: 'approved', type: 'bool' },
            { name: 'reason', type: 'string' }
          ],
          stateMutability: 'nonpayable',
        }
      ] as const;

      const txHash = await walletClient.writeContract({
        address: this.routerAddress,
        abi: RISK_ROUTER_ABI,
        functionName: 'submitTradeIntent',
        args: [
          {
            agentId: BigInt(intent.agentId),
            agentWallet: intent.agentWallet as Hex,
            pair: intent.pair,
            action: intent.action,
            amountUsdScaled: BigInt(intent.amountUsdScaled),
            maxSlippageBps: BigInt(intent.maxSlippageBps),
            nonce: BigInt(intent.nonce),
            deadline: BigInt(intent.deadline),
          },
          signature,
        ],
      });

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error) {
      if (error instanceof CriticalSecurityException) throw error;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * @dev Waits for a transaction to be confirmed with retry logic.
   * Sepolia can be slow, so we use a longer timeout and retry.
   */
  async waitForTradeAuthorization(
    txHash: Hex,
    timeoutMs: number = 90000 // Increased to 90 seconds for Sepolia
  ): Promise<{ authorized: boolean; reason?: string }> {
    try {
      const chain = this.getChain();
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      // Retry up to 3 times with increasing timeouts
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: timeoutMs,
            pollingInterval: 4_000, // Poll every 4 seconds
          });
          return { authorized: receipt.status === 'success' };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < 3) {
            logger.warn({ module: 'RiskRouter', step: 'RETRY_RECEIPT', attempt });
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s between retries
          }
        }
      }

      return {
        authorized: false,
        reason: lastError?.message || 'Transaction receipt not found after retries',
      };
    } catch (error) {
      return {
        authorized: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
