import { AgentStackClient } from '../src/logic/clients/agent_stack.js';
import { logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("================================================================");
  console.log("🔍 VERTEX SENTINEL: x402 PAYMENT HANDSHAKE VERIFICATION 🔍");
  console.log("================================================================");

  const pair = 'BTC/USD';
  const intent = 'BUY';
  const localRiskScore = 45;

  console.log(`\n[1/3] Initiating Trade Verification for ${pair}...`);
  
  try {
    const result = await AgentStackClient.verifyTrade(intent, localRiskScore, pair);

    if (result.verified) {
      console.log(`\n✅ SUCCESS: Orchestration Verified with x402 Handshake!`);
      console.log(`   Proof (Arc L1): ${result.proof}`);
      console.log(`   Worker Data: ${result.workerData?.substring(0, 50)}...`);
      console.log(`   Timestamp: ${result.timestamp}`);
    } else {
      console.log(`\n❌ FAILED: Verification returned false.`);
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`\n💥 CRITICAL ERROR: ${error.message}`);
    process.exit(1);
  }

  console.log("\n================================================================");
  console.log("🏁 VERIFICATION COMPLETE 🏁");
  console.log("================================================================");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
