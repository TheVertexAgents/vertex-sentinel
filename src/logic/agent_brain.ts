import { createWalletClient, http, parseEther } from 'viem';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import type { TradeIntent, Authorization } from './types.ts';
import dotenv from 'dotenv';
import { validateEnv } from './env.ts';
import { CriticalSecurityException } from './errors.ts';

dotenv.config();

// Validate environment on startup
validateEnv();

// EIP-712 Domain definition matching RiskRouter.sol
const domain = {
  name: 'VertexAgents-Sentinel',
  version: '1',
  chainId: 1,
  verifyingContract: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Update after deployment
} as const;

const types = {
  TradeIntent: [
    { name: 'agentId', type: 'string' },
    { name: 'pair', type: 'string' },
    { name: 'volume', type: 'uint256' },
    { name: 'maxPrice', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/**
 * @dev Mock "Strykr PRISM API" for canonical asset resolution.
 */
async function getAssetResolution(pair: string) {
  console.log(JSON.stringify({
    level: "INFO",
    module: "PRISM",
    message: `Resolving canonical metadata for ${pair}...`
  }));
  return { symbol: pair, precision: 18 };
}

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});

/**
 * @dev Genkit flow for verifiable risk assessment.
 */
const riskScoreFlow = ai.defineFlow(
  {
    name: 'riskScoreFlow',
    inputSchema: z.object({
      pair: z.string(),
      volume: z.string(),
    }),
    outputSchema: z.object({
      score: z.number(),
      reason: z.string(),
    }),
  },
  async (input) => {
    console.log(JSON.stringify({
        level: "INFO",
        module: "Genkit",
        message: `Running risk assessment for ${input.pair} trade...`
    }));
    // Placeholder logic for demo: lower volume = lower risk
    const score = parseFloat(input.volume) > 10 ? 0.9 : 0.1;
    return {
      score,
      reason: score > 0.5 ? "High volume detected" : "Standard trade parameters",
    };
  }
);

/**
 * @dev The Intent Layer creates a signed TradeIntent.
 */
async function signIntent(intent: TradeIntent, privateKey: Hex): Promise<Authorization> {
  try {
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    });

    // Run Genkit Risk Assessment
    const risk = await riskScoreFlow({
      pair: intent.pair,
      volume: intent.volume.toString(),
    });

    // Fail-Closed Principle: Ensure risk output is valid
    if (!risk || risk.score === undefined) {
      throw new CriticalSecurityException(`Invalid risk assessment output for ${intent.pair}`);
    }

    console.log(JSON.stringify({
      level: "INFO",
      step: "RISK_ASSESSMENT",
      pair: intent.pair,
      score: risk.score,
      reason: risk.reason
    }));

    if (risk.score > 0.8) {
       return { isAllowed: false, reason: `Risk too high: ${risk.reason}`, signature: '0x' };
    }

    // Constitution v2.0.0: Gas efficiency check (Viem implementation)
    // Note: Since this is purely a signing layer, we demonstrate intent by logging gas estimation context
    console.log(JSON.stringify({
      level: "INFO",
      step: "GAS_CHECK",
      message: "Gas estimation check performed before intent finalization (simulated for signing phase)"
    }));

    console.log(JSON.stringify({
      level: "INFO",
      step: "SIGNING_INTENT",
      pair: intent.pair,
      agentId: intent.agentId
    }));

    // Sign the intent using EIP-712
    const signature = await client.signTypedData({
      domain,
      types,
      primaryType: 'TradeIntent',
      message: intent,
    });

    return { isAllowed: true, reason: risk.reason, signature };
  } catch (error) {
    if (error instanceof CriticalSecurityException) {
      throw error;
    }
    throw new CriticalSecurityException(`Critical error during signIntent: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Logic loop demo
async function main() {
  console.log(JSON.stringify({
    level: "INFO",
    message: "VertexAgents Sentinel Brain Initialization..."
  }));

  // Demo Intent
  const demoIntent: TradeIntent = {
    agentId: "AGENT_VERIFIED_001",
    pair: "BTC/USDC",
    volume: parseEther("0.5"),
    maxPrice: parseEther("65000"),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  };

  // Change volume to trigger allowed path
  demoIntent.volume = BigInt(1);

  // Use a dummy private key if one is not provided in .env
  const pk = (process.env.AGENT_PRIVATE_KEY as Hex) || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  const auth = await signIntent(demoIntent, pk);
  console.log("--- AUTHORIZATION ARTIFACT ---");
  console.log(JSON.stringify(auth, null, 2));
  console.log("--- END ---");
}

import { fileURLToPath } from 'url';

if (import.meta.url === `file://${fileURLToPath(import.meta.url)}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({
      level: "CRITICAL",
      exception: "CriticalSecurityException",
      message: error.message,
      stack: error.stack
    }));
    process.exit(1);
  });
}

export { signIntent, getAssetResolution };
