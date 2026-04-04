import { createWalletClient, http, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
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
}
