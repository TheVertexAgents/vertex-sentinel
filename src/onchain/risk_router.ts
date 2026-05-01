import { createWalletClient, createPublicClient, http, fallback, keccak256, encodeAbiParameters, parseAbiParameters, type Hex, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat, mainnet, base, arbitrum } from 'viem/chains';
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

  private getChain(): Chain {
    const chainMap: Record<number, Chain> = {
      1: mainnet as Chain,
      11155111: sepolia as Chain,
      8453: base as Chain,
      42161: arbitrum as Chain,
      31337: hardhat as Chain
    };
    return chainMap[this.chainId] || (sepolia as Chain);
  }

  private getTransport() {
    if (this.chainId === 31337) return http();

    const transports = [];
    const networkName = this.chainId === 1 ? 'mainnet' :
                       this.chainId === 8453 ? 'base-mainnet' :
                       this.chainId === 42161 ? 'arbitrum-mainnet' : 'sepolia';

    if (process.env.INFURA_KEY) {
      transports.push(http(`https://${networkName}.infura.io/v3/${process.env.INFURA_KEY}`));
    }
    if (process.env.ALCHEMY_KEY) {
      transports.push(http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`));
    }

    // Fallback to default http if no keys provided, though validateEnv should catch this
    if (transports.length === 0) return http();

    return fallback(transports);
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
        transport: this.getTransport(),
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
   * @dev Fetches risk parameters for an agent.
   */
  async riskParams(agentId: bigint): Promise<any> {
    const publicClient = createPublicClient({
      chain: this.getChain(),
      transport: this.getTransport(),
    });

    return await publicClient.readContract({
      address: this.routerAddress,
      abi: [
        {
          name: 'riskParams',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: '', type: 'uint256' }],
          outputs: [
            { name: 'maxPositionUsdScaled', type: 'uint256' },
            { name: 'maxDrawdownBps', type: 'uint256' },
            { name: 'maxTradesPerHour', type: 'uint256' },
            { name: 'active', type: 'bool' },
          ],
        },
      ],
      functionName: 'riskParams',
      args: [agentId],
    });
  }

  /**
   * @dev Signs a TradeIntent using EIP-712. Supports local private key or Circle WaaS.
   */
  async signIntent(intent: TradeIntent, privateKey: Hex): Promise<Hex> {
    try {
      const useCircle = process.env.USE_CIRCLE_WAAS === 'true';
      const { domain, types } = this.getTypedData();
      const message = {
        agentId: BigInt(intent.agentId),
        agentWallet: intent.agentWallet as Hex,
        pair: intent.pair,
        action: intent.action,
        amountUsdScaled: BigInt(intent.amountUsdScaled),
        maxSlippageBps: BigInt(intent.maxSlippageBps),
        nonce: BigInt(intent.nonce),
        deadline: BigInt(intent.deadline),
      };

      if (useCircle) {
        const { CircleSigner } = await import('./circle_signer.js');
        const signer = new CircleSigner();
        return await signer.signTypedData(domain, types.TradeIntent, 'TradeIntent', message);
      }

      const account = privateKeyToAccount(privateKey);
      const client = createWalletClient({
        account,
        chain: this.getChain(),
        transport: this.getTransport(),
      });

      const signature = await client.signTypedData({
        domain,
        types,
        primaryType: 'TradeIntent',
        message,
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
      const useCircle = process.env.USE_CIRCLE_WAAS === 'true';
      const chain = this.getChain();

      const walletClient = createWalletClient({
        account: useCircle ? undefined : privateKeyToAccount(privateKey),
        chain,
        transport: this.getTransport(),
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

      if (useCircle) {
          // Circle WaaS Activation: Represent authorization via USDC nanopayment on Arc L1
          const { CirclePayments } = await import('./circle.js');
          const destinationWallet = process.env.ORCHESTRATOR_WALLET_ADDRESS!;

          const txHash = await CirclePayments.sendPayment({
            destinationWallet,
            amount: "0.001", // Symbolic nanopayment for authorization
            invoiceId: `AUTH-${intent.nonce}-${intent.pair.replace('/', '-')}`
          });

          logger.info({ module: 'RiskRouter', step: 'CIRCLE_TRADE_AUTHORIZED_ARC_L1', nonce: intent.nonce, txHash });
          return { success: true, transactionHash: txHash as Hex };
      }

      const publicClient = createPublicClient({
        chain,
        transport: this.getTransport(),
      });

      // Sepolia Hardening: Nonce Safety (#148)
      const account = walletClient.account || (useCircle ? (process.env.AGENT_WALLET_ADDRESS as Hex) : null) as any;
      const txNonce = await publicClient.getTransactionCount({
        address: typeof account === 'string' ? account : account.address,
        blockTag: 'pending'
      });

      // Sepolia Hardening: Dynamic Gas Price (#148)
      let gasConfig: any = {};
      try {
        const feeData = await publicClient.estimateFeesPerGas();
        const priorityFee = feeData.maxPriorityFeePerGas;
        const maxFee = feeData.maxFeePerGas;

        // Add 50% buffer for initial submission to ensure fast inclusion
        const bufferedPriorityFee = (priorityFee * 150n) / 100n;
        const bufferedMaxFee = (maxFee * 150n) / 100n;

        gasConfig = {
          maxPriorityFeePerGas: bufferedPriorityFee,
          maxFeePerGas: bufferedMaxFee,
        };
        logger.info({ module: 'RiskRouter', step: 'GAS_ESTIMATED', priorityFee: priorityFee.toString(), maxFee: maxFee.toString(), bufferedPriority: bufferedPriorityFee.toString(), bufferedMax: bufferedMaxFee.toString() });
      } catch (e) {
        logger.warn({ module: 'RiskRouter', step: 'GAS_ESTIMATION_FAILED', error: String(e) });
      }

      const txHash = await walletClient.writeContract({
        address: this.routerAddress,
        account,
        abi: RISK_ROUTER_ABI,
        functionName: 'submitTradeIntent',
        chain,
        nonce: txNonce,
        ...gasConfig,
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

      // Transaction Resubmission Logic (#148)
      const STUCK_TIMEOUT = 45000; // Reduced to 45 seconds for first attempt
      let confirmed = false;
      let currentTxHash = txHash;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.info({ module: 'RiskRouter', step: 'WAITING_FOR_CONFIRMATION', txHash: currentTxHash, attempt });
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: currentTxHash,
            timeout: attempt === 1 ? STUCK_TIMEOUT : 60000,
          });
          if (receipt.status === 'success') {
            confirmed = true;
            return { success: true, transactionHash: currentTxHash };
          } else {
            throw new Error(`Transaction reverted: ${currentTxHash}`);
          }
        } catch (error: any) {
          if (attempt < 3 && (error.name === 'WaitForTransactionReceiptTimeoutError' || error.message?.includes('timeout'))) {
             logger.warn({ module: 'RiskRouter', step: 'TX_STUCK', txHash: currentTxHash, attempt });

             // Bump gas for resubmission
             try {
                const feeData = await publicClient.estimateFeesPerGas();
                // Bump by 150% as per requirements
                const bumpedPriorityFee = (feeData.maxPriorityFeePerGas * 150n) / 100n;
                const bumpedMaxFee = (feeData.maxFeePerGas * 150n) / 100n;

                logger.info({ module: 'RiskRouter', step: 'RESUBMITTING_TX', intentNonce: intent.nonce, txNonce, bumpedPriorityFee: bumpedPriorityFee.toString(), bumpedMaxFee: bumpedMaxFee.toString() });

                currentTxHash = await walletClient.writeContract({
                  address: this.routerAddress,
                  account,
                  abi: RISK_ROUTER_ABI,
                  functionName: 'submitTradeIntent',
                  chain,
                  maxPriorityFeePerGas: bumpedPriorityFee,
                  maxFeePerGas: bumpedMaxFee,
                  nonce: txNonce, // Re-use same EOA nonce for replacement
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
             } catch (resubmitError: any) {
                logger.error({ module: 'RiskRouter', step: 'RESUBMISSION_FAILED', error: resubmitError.message });
                // If resubmission fails (e.g. nonce already used), try to wait for the original tx one more time?
                // Or just break and fail.
                break;
             }
          } else {
            return { success: false, error: error.message, transactionHash: currentTxHash };
          }
        }
      }

      return {
        success: confirmed,
        transactionHash: currentTxHash,
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
        transport: this.getTransport(),
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
