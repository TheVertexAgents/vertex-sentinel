import { expect } from 'chai';
import { createSignedCheckpoint } from './src/utils/checkpoint.js';
import { CriticalSecurityException } from './src/logic/errors.js';

async function verifyCheckpointChange() {
  console.log("Verifying checkpoint.ts change...");
  const agent: any = { name: "Test", version: "1.0.0", agentId: 1 };
  const decision: any = { reasoning: "Test" };

  try {
    // @ts-ignore
    await createSignedCheckpoint(agent, decision, undefined, 31337);
    console.error("❌ FAILED: createSignedCheckpoint did not throw when privateKey is missing");
    process.exit(1);
  } catch (e: any) {
    if (e instanceof CriticalSecurityException && e.message.includes("Fail-Closed: privateKey is required")) {
      console.log("✅ PASSED: createSignedCheckpoint threw CriticalSecurityException as expected");
    } else {
      console.error("❌ FAILED: createSignedCheckpoint threw unexpected error:", e);
      process.exit(1);
    }
  }
}

verifyCheckpointChange();
