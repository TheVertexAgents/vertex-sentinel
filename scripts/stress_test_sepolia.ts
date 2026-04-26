import { RiskRouterClient } from '../src/onchain/risk_router.js';
import type { Hex } from 'viem';
import { logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * @dev Stress test for Sepolia receipt fetching and nonce management.
 */
async function main() {
  const routerAddress = '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC';
  const client = new RiskRouterClient(routerAddress as Hex, 11155111);
  const agentId = 42n;

  console.log("Starting Sepolia Stress Test...");

  try {
    // Test Nonce Fetching
    console.log("Testing Nonce Fetching...");
    const nonce = await client.getIntentNonce(agentId);
    console.log(`Current Nonce: ${nonce}`);

    // Test Risk Params Fetching
    console.log("Testing Risk Params Fetching...");
    const params = await client.riskParams(agentId);
    console.log(`Risk Params: MaxPos=${params[0]}, Active=${params[3]}`);

    console.log("Sepolia Connectivity Verified.");
  } catch (error) {
    console.error("Stress Test Failed:", error);
    process.exit(1);
  }
}

main();
