import { logger } from '../utils/logger.js';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import dotenv from 'dotenv';

dotenv.config();

/**
 * @title Circle Nanopayments Client (Sentinel)
 * @dev Handles dispatching USDC nanopayments on Arc L1 for verification services.
 */
export class CirclePayments {
  /**
   * @dev Sends a nanopayment to the orchestrator.
   */
  static async sendPayment(params: {
    destinationWallet: string;
    amount: string;
    invoiceId: string;
  }) {
    const apiKey = process.env.CIRCLE_API_KEY;
    const walletId = process.env.AGENT_WALLET_ID;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !walletId || !entitySecret) {
      throw new Error('Missing CIRCLE_API_KEY, AGENT_WALLET_ID, or CIRCLE_ENTITY_SECRET in environment. CirclePayments requires real credentials for verifiable handshakes.');
    }

    try {
      logger.info({ 
        module: 'CirclePayments', 
        message: 'Initiating verification payment', 
        invoice: params.invoiceId,
        amount: params.amount 
      });

      const client = initiateDeveloperControlledWalletsClient({
        apiKey,
        entitySecret,
        baseUrl: "https://api.circle.com"
      });
      
      const response = await client.createTransaction({
        walletId: walletId,
        destinationAddress: params.destinationWallet,
        amount: [params.amount],
        fee: {
          type: "level",
          config: {
            feeLevel: "MEDIUM"
          }
        },
        tokenAddress: process.env.USDC_CONTRACT_ADDRESS || "0x3600000000000000000000000000000000000000",
        blockchain: "ARC-TESTNET" as any
      });

      const txId = response.data?.id;
      if (!txId) throw new Error("Circle transaction creation failed: No ID returned");

      let txHash = null;
      let attempts = 0;
      
      // Wait for settlement on Arc L1
      while (attempts < 15) {
        await new Promise(r => setTimeout(r, 2000));
        const txStatus = await client.getTransaction({ id: txId });
        
        if (txStatus.data?.transaction?.txHash) {
          txHash = txStatus.data.transaction.txHash;
          break;
        }
        
        if (txStatus.data?.transaction?.state === "FAILED") {
          throw new Error(`Circle transaction failed: ${txStatus.data.transaction.errorReason}`);
        }
        
        attempts++;
      }

      if (!txHash) {
        throw new Error("Timeout waiting for Circle transaction hash to settle on Arc L1");
      }

      logger.info({ 
        module: 'CirclePayments', 
        message: 'Verification payment settled', 
        txHash,
        invoice: params.invoiceId 
      });

      return txHash;
    } catch (error: any) {
      logger.error({ 
        module: 'CirclePayments', 
        message: 'Payment dispatch failed', 
        error: error.message 
      });
      throw error;
    }
  }
}
