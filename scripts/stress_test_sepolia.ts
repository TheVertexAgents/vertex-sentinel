import { RiskRouterClient } from '../src/onchain/risk_router.js';
import type { Hex } from 'viem';
import { logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * @dev Stress test for Sepolia receipt fetching and gas bumping.
 * This script simulates a scenario where transactions might get stuck by using low gas (if possible)
 * or simply triggers the resubmission logic by mocking a timeout if we want to test the logic specifically.
 * For this version, it exercises the real RiskRouterClient authorizeTrade method.
 */
async function main() {
  const routerAddress = process.env.RISK_ROUTER_ADDRESS as Hex || '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC';
  const client = new RiskRouterClient(routerAddress, 11155111);
  const agentId = BigInt(process.env.AGENT_ID || "1");
  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex;

  if (!privateKey) {
      console.error("AGENT_PRIVATE_KEY missing in .env");
      process.exit(1);
  }

  console.log("Starting Sepolia Gas Bumping & Nonce Stress Test...");

  try {
    const nonce = await client.getIntentNonce(agentId);

    const intent = {
      agentId: Number(agentId),
      agentWallet: process.env.AGENT_WALLET_ADDRESS!,
      pair: 'BTC/USDC',
      action: 'buy',
      amountUsdScaled: 100, // $1.00
      maxSlippageBps: 100,
      nonce: Number(nonce),
      deadline: Math.floor(Date.now() / 1000) + 3600
    };

    console.log("Signing Intent...");
    const signature = await client.signIntent(intent, privateKey);

    console.log("Submitting Intent with Enhanced Gas Logic...");
    // This will trigger the new logic:
    // 1. Fetching pending nonce
    // 2. 150% Gas Bumping
    // 3. 45s STUCK_TIMEOUT (if it takes long)
    const result = await client.authorizeTrade(intent, signature, privateKey);

    if (result.success) {
      console.log("SUCCESS: Transaction confirmed:", result.transactionHash);
    } else {
      console.error("FAILED:", result.error);
    }

  } catch (error) {
    console.error("Stress Test Error:", error);
    process.exit(1);
  }
}

main();
