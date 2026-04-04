import { createWalletClient, http } from 'viem';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import type { TradeIntent, Authorization } from './types.js';
import dotenv from 'dotenv';
import { validateEnv } from './env.js';
import { CriticalSecurityException } from './errors.js';
import { loadAgentMetadata } from './config.js';
import { analyzeRisk } from './strategy/risk_assessment.js';
import { createSignedCheckpoint } from '../utils/checkpoint.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

// Validate environment and load metadata on startup
if (process.env.NODE_ENV !== 'test') {
    validateEnv();
}
const agentMetadata = loadAgentMetadata();

/**
 * @dev Loads the deployment configuration for the current environment.
 */
function getDeploymentConfig() {
  const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');

  if (process.env.NETWORK === 'sepolia') {
    if (!fs.existsSync(deploymentsPath)) {
      throw new CriticalSecurityException('Fail-Closed: deployments_sepolia.json is missing but NETWORK is set to sepolia');
    }
    try {
      return JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    } catch (error) {
      throw new CriticalSecurityException(`Fail-Closed: Failed to parse deployments_sepolia.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Default to Local Hardhat if not explicitly set to sepolia
  return {
    chainId: 31337, // Hardhat default
    riskRouter: '0x0000000000000000000000000000000000000000' // Placeholder for local
  };
}

const config = getDeploymentConfig();

// EIP-712 Domain definition matching RiskRouter.sol
const domain = {
  name: 'RiskRouter',
  version: '1',
  chainId: config.chainId || 11155111,
  verifyingContract: config.riskRouter as `0x${string}`,
} as const;

const types = {
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
} as const;

/**
 * @dev Helper to get a unique trace ID.
 */
function getTraceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * @dev Mock "Strykr PRISM API" for canonical asset resolution.
 */
async function getAssetResolution(pair: string) {
  console.log(JSON.stringify({
    level: "INFO",
    module: "PRISM",
    message: `Resolving canonical metadata for ${pair}...`,
    timestamp: new Date().toISOString()
  }));
  return { symbol: pair, precision: 18 };
}

/**
 * @dev The Intent Layer creates a signed TradeIntent after verifiable risk assessment.
 */
async function signIntent(intent: TradeIntent, privateKey: Hex): Promise<Authorization> {
  const traceId = getTraceId();
  try {
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    });

    // 1. Run Strategic Risk Assessment (Refactored)
    const decision = await analyzeRisk(intent.pair, intent.amountUsdScaled);

    // 2. Create and Sign Audit Checkpoint (Verifiable Execution)
    await createSignedCheckpoint(agentMetadata, decision, privateKey);

    console.error(JSON.stringify({
      level: "INFO",
      step: "RISK_ASSESSMENT",
      TRACE_ID: traceId,
      pair: intent.pair,
      score: decision.riskScore,
      reason: decision.reasoning,
      timestamp: new Date().toISOString()
    }));

    if (decision.action === 'HOLD') {
       return { isAllowed: false, reason: `Risk too high or strategy HOLD: ${decision.reasoning}`, signature: '0x' };
    }

    console.error(JSON.stringify({
      level: "INFO",
      step: "SIGNING_INTENT",
      TRACE_ID: traceId,
      pair: intent.pair,
      agentId: intent.agentId.toString(),
      timestamp: new Date().toISOString()
    }));

    // 3. Sign the intent using EIP-712
    const signature = await client.signTypedData({
      domain,
      types,
      primaryType: 'TradeIntent',
      message: {
        ...intent,
        agentWallet: intent.agentWallet as `0x${string}`,
      },
    });

    return { isAllowed: true, reason: decision.reasoning, signature };
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
    message: `VertexAgents Sentinel Brain Initialization for ${agentMetadata.name} v${agentMetadata.version}...`
  }));

  // Demo Intent
  const demoIntent: TradeIntent = {
    agentId: BigInt(agentMetadata.agentId),
    agentWallet: '0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9',
    pair: 'BTC/USDC',
    action: 'BUY',
    amountUsdScaled: 10000n, // $100.00
    maxSlippageBps: 100n,
    nonce: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  };

  // Environment validation ensures AGENT_PRIVATE_KEY is present
  const pk = process.env.AGENT_PRIVATE_KEY as Hex;

  const auth = await signIntent(demoIntent, pk);
  console.log("--- AUTHORIZATION ARTIFACT ---");
  console.log(JSON.stringify(auth, null, 2));
  console.log("--- END ---");
}

if (import.meta.url === `file://${fileURLToPath(import.meta.url)}` || (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))) {
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
