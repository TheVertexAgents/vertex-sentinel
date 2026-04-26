import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { logger } from '../utils/logger.js';
import type { Hex } from 'viem';
import { CriticalSecurityException } from '../logic/errors.js';

/**
 * @title Circle WaaS Signer
 * @dev Handles signing transactions and typed data using Circle Developer-Controlled Wallets.
 */
export class CircleSigner {
  private client;
  private walletId: string;

  constructor() {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    const walletId = process.env.AGENT_WALLET_ID;

    if (!apiKey || !entitySecret || !walletId) {
      throw new CriticalSecurityException('Missing Circle WaaS configuration: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, or AGENT_WALLET_ID');
    }

    this.client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
      baseUrl: "https://api.circle.com"
    });
    this.walletId = walletId;
  }

  /**
   * @dev Signs EIP-712 typed data using Circle WaaS.
   */
  async signTypedData(domain: any, types: any, primaryType: string, message: any): Promise<Hex> {
    try {
      logger.info({ module: 'CircleSigner', step: 'SIGN_TYPED_DATA', primaryType });

      const response = await this.client.signTypedData({
        walletId: this.walletId,
        data: JSON.stringify({
            domain,
            types,
            primaryType,
            message
        })
      });

      const signature = response.data?.signature;
      if (!signature) {
        throw new Error('Circle WaaS returned no signature');
      }

      return signature as Hex;
    } catch (error: any) {
      logger.error({ module: 'CircleSigner', step: 'SIGN_TYPED_DATA_FAILED', error: error.message });
      throw new CriticalSecurityException(`Circle WaaS signing failed: ${error.message}`);
    }
  }

  /**
   * @dev Signs a transaction using Circle WaaS.
   */
  async executeContractCall(params: {
    abi: any;
    contractAddress: Hex;
    functionName: string;
    args: any[];
    blockchain: string;
  }): Promise<Hex> {
      console.log(params); // avoid unused param warning
      throw new Error("Circle WaaS direct contract call execution not yet implemented. Use EIP-712 signing for now.");
  }
}
