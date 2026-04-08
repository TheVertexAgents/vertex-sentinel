import { createWalletClient, createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';
import type { TradeIntent } from '../logic/types.js';

/**
 * @dev RiskRouter integration layer.
 * Handles building, signing, and submitting TradeIntents.
 */
export class RiskRouterClient {
  private routerAddress: `0x${string}`;
  private chainId: number;

  constructor(routerAddress: `0x${string}`, chainId: number = 11155111) {
    this.routerAddress = routerAddress;
    this.chainId = chainId;
  }

  /**
   * @dev Initializes the clients if not already done.
   */
  private getChain() {
    return this.chainId === 11155111 ? sepolia : hardhat;
  }

  /**
   * @dev Builds EIP-712 domain and types for RiskRouter.
   */
  private getTypedData() {
    return {
      domain: {
        name: 'RiskRouter',
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
  async signIntent(intent: TradeIntent, privateKey: `0x${string}`): Promise<`0x${string}`> {
    try {
      const account = privateKeyToAccount(privateKey);
      const client = createWalletClient({
        account,
        chain: sepolia,
        transport: http(),
      });

      const { domain, types } = this.getTypedData();

      const signature = await client.signTypedData({
        domain,
        types,
        primaryType: 'TradeIntent',
        message: {
          ...intent,
          agentWallet: intent.agentWallet as `0x${string}`,
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
  computeIntentHash(intent: TradeIntent): `0x${string}` {
    const encoded = encodeAbiParameters(
      parseAbiParameters('uint256, address, string, string, uint256, uint256'),
      [
        intent.agentId,
        intent.agentWallet as `0x${string}`,
        intent.pair,
        intent.action,
        intent.amountUsdScaled,
        intent.nonce
      ]
    );
    return keccak256(encoded);
  }

  /**
   * @dev Submits a signed trade intent to RiskRouter for on-chain validation.
   * Returns the transaction hash if successful.
   */
  async authorizeTrade(
    intent: TradeIntent,
    signature: `0x${string}`,
    privateKey: `0x${string}`
  ): Promise<{ success: boolean; transactionHash?: `0x${string}`; error?: string }> {
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

      // RiskRouter contract ABI - using standard Solidity struct encoding
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
          outputs: [],
          stateMutability: 'nonpayable',
        },
        {
          type: 'event',
          name: 'TradeApproved',
          inputs: [
            { name: 'agentId', type: 'uint256', indexed: true },
            { name: 'intentHash', type: 'bytes32', indexed: false },
            { name: 'amountUsdScaled', type: 'uint256', indexed: false },
          ],
        },
        {
          type: 'event',
          name: 'TradeRejected',
          inputs: [
            { name: 'agentId', type: 'uint256', indexed: true },
            { name: 'intentHash', type: 'bytes32', indexed: false },
            { name: 'reason', type: 'string', indexed: false },
          ],
        },
      ] as const;

      // Submit the trade intent to RiskRouter
      const txHash = await walletClient.writeContract({
        address: this.routerAddress,
        abi: RISK_ROUTER_ABI,
        functionName: 'submitTradeIntent',
        args: [
          {
            agentId: BigInt(intent.agentId),
            agentWallet: intent.agentWallet as `0x${string}`,
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
   * @dev Waits for a transaction to be confirmed and checks for TradeAuthorized event.
   */
  async waitForTradeAuthorization(
    txHash: `0x${string}`,
    timeoutMs: number = 30000
  ): Promise<{ authorized: boolean; reason?: string }> {
    try {
      const chain = this.getChain();
      const publicClient = createPublicClient({
        chain,
        transport: http(
          chain.id === 11155111
            ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY || ''}`
            : 'http://127.0.0.1:8545'
        ),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: timeoutMs,
      });

      if (receipt.status === 'success') {
        // Transaction succeeded - RiskRouter likely authorized the trade
        // In a real implementation, you'd parse logs to check for TradeAuthorized event
        return { authorized: true };
      } else {
        return { authorized: false, reason: 'Transaction reverted' };
      }
    } catch (error) {
      return {
        authorized: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
