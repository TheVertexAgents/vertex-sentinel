import { createWalletClient, createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';
import type { TradeIntent } from '../logic/types.js';

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
    // Demo Mode Guard
    if (this.routerAddress === '0x0000000000000000000000000000000000000000' || process.env.DEMO_MODE === 'true') {
        console.warn(`[RiskRouterClient] Skipping on-chain submission (DEMO_MODE=true or zero address)`);
        return { success: true };
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
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * @dev Waits for a transaction to be confirmed.
   */
  async waitForTradeAuthorization(
    txHash: Hex,
    timeoutMs: number = 30000
  ): Promise<{ authorized: boolean; reason?: string }> {
    try {
      const chain = this.getChain();
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: timeoutMs,
      });

      return { authorized: receipt.status === 'success' };
    } catch (error) {
      return {
        authorized: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
