import { logger } from '../../utils/logger.js';
import { validateEnv } from '../env.js';

export interface VerificationResult {
  verified: boolean;
  proof?: string;
  workerData?: string;
  timestamp?: string;
  error?: string;
}

/**
 * @dev AgentStack Client - Verification Layer for Arc L1.
 * This client "hires" the AgentStack Orchestrator to ensure market and sentiment data integrity.
 */
export const AgentStackClient = {
  /**
   * @dev Calls the Orchestrator to verify a trade intent.
   * @param intent The intended action ('BUY', 'SELL', 'HOLD')
   * @param localRiskScore The score calculated by the Sentinel's local risk engine
   * @param pair The trading pair (e.g., 'BTC/USDC')
   */
  async verifyTrade(intent: string, localRiskScore: number, pair: string): Promise<VerificationResult> {
    const env = validateEnv();
    const baseUrl = env.AGENT_STACK_URL;
    const url = `${baseUrl}/orchestrate`;

    const payload = {
      prompt: `Provide verified ${pair} sentiment and market data for trade validation`,
      context: { intent, localRiskScore }
    };

    logger.info({ module: 'AGENT_STACK_CLIENT', step: 'REQUEST_START', url, pair });

    try {
      // 1. Initial Attempt
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // 2. Handle x402 Payment Handshake
      if (response.status === 402) {
        const challenge = response.headers.get('x402-payment-request');
        if (!challenge) throw new Error('402 received but x402-payment-request header is missing');

        logger.info({ module: 'AGENT_STACK_CLIENT', step: 'PAYMENT_REQUIRED', challenge });

        // Parse challenge: invoiceId:amount:destination
        const [invoiceId, amount, destinationWallet] = challenge.split(':');
        
        // Trigger Circle Nanopayment
        const { CirclePayments } = await import('../../onchain/circle.js');
        const txHash = await CirclePayments.sendPayment({
          destinationWallet,
          amount,
          invoiceId
        });

        logger.info({ module: 'AGENT_STACK_CLIENT', step: 'PAYMENT_SENT', txHash });

        // 3. Retry with Payment Proof
        response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x402-payment-proof': txHash
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        throw new Error(`Orchestrator responded with status: ${response.status}`);
      }

      const data = await response.json() as any;

      // Extract Proof (Transaction Hash) and Worker Data
      const proof = data.settlementHash || data.transactionHash || data.proof;
      const workers = data.workers || [];

      if (!proof) {
        logger.warn({ module: 'AGENT_STACK_CLIENT', message: 'No settlement proof found in orchestrator response' });
        return {
          verified: false,
          error: 'Missing settlement proof from orchestrator'
        };
      }

      logger.info({ module: 'AGENT_STACK_CLIENT', step: 'VERIFIED', proof });

      return {
        verified: true,
        proof,
        workerData: JSON.stringify(workers),
        timestamp: data.timestamp
      };

    } catch (err: any) {
      logger.error({ module: 'AGENT_STACK_CLIENT', step: 'FAILED', error: err.message });
      return {
        verified: false,
        error: err.message
      };
    }
  }
};
