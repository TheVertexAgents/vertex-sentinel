import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { TradeIntent, Authorization } from './types.js';
import dotenv from 'dotenv';
import { validateEnv } from './env.js';
import { CriticalSecurityException } from './errors.js';
import { loadAgentMetadata } from './config.js';
import { analyzeRisk } from './strategy/risk_assessment.js';
import { createSignedCheckpoint } from '../utils/checkpoint.js';
import { formatExplanation } from '../utils/explainability.js';
import { RiskRouterClient } from '../onchain/risk_router.js';
import { IdentityClient } from '../onchain/identity.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PnLTracker } from './pnl/tracker.js';

dotenv.config();

// Validate environment and load metadata on startup
if (process.env.NODE_ENV !== 'test') {
    validateEnv();
}

/**
 * @dev Lazily loaded agent metadata to support test environments.
 */
let _agentMetadata: any = null;
function getAgentMetadata() {
  if (!_agentMetadata) {
    _agentMetadata = loadAgentMetadata();
  }
  return _agentMetadata;
}

/**
 * @dev Lazily loaded PnL tracker for current session.
 */
let _pnlTracker: PnLTracker | null = null;
function getPnLTracker() {
  if (!_pnlTracker) {
    _pnlTracker = new PnLTracker();
  }
  return _pnlTracker;
}

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
    riskRouter: '0x0000000000000000000000000000000000000000', // Placeholder for local
    agentRegistry: '0x0000000000000000000000000000000000000000' // Placeholder for local
  };
}

const config = getDeploymentConfig();

// Init On-Chain Clients
const riskRouterClient = new RiskRouterClient(config.riskRouter as Hex, config.chainId);
const identityClient = new IdentityClient(config.agentRegistry as Hex, config.chainId);

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

    // 1. Check Identity (ERC-8004 Alignment)
    // Note: RiskRouter.authorizeTrade() will be the source of truth for authorization
    // Pre-check is informational only; RiskRouter validation is required
    try {
      const isRegistered = await identityClient.isAgentRegistered(account.address);
      if (!isRegistered) {
        console.warn(`[agent_brain] Agent not found in AgentRegistry (non-critical). RiskRouter will perform final authorization...`);
      }
    } catch (error) {
      console.warn(`[agent_brain] AgentRegistry check failed (non-critical): ${error instanceof Error ? error.message : String(error)}. Proceeding with RiskRouter authorization...`);
    }

    // 2. Run Strategic Risk Assessment (Refactored)
    const decision = await analyzeRisk(intent.pair, intent.amountUsdScaled);

    // 3. Update PnL Tracker before checkpoint
    const tracker = getPnLTracker();
    // Assuming entry price is current market price for demo purposes
    // In a real flow, the order result should be used to record the actual execution price
    const mockPrice = 67000; // Placeholder until integrated with real execution callback
    tracker.recordTrade({
      id: traceId,
      pair: intent.pair,
      side: intent.action as 'BUY' | 'SELL',
      price: mockPrice,
      amount: Number(intent.amountUsdScaled) / 100 / mockPrice, // Simple conversion for demo
      timestamp: new Date().toISOString()
    });

    const currentPnL = tracker.getMetrics();

    // 4. Create and Sign Audit Checkpoint (Verifiable Execution)
    await createSignedCheckpoint(getAgentMetadata(), decision, privateKey, config.chainId, currentPnL);

    // 5. Persist PnL to logs/pnl.json
    const pnlLogPath = path.join(process.cwd(), 'logs/pnl.json');
    if (!fs.existsSync(path.dirname(pnlLogPath))) {
        fs.mkdirSync(path.dirname(pnlLogPath), { recursive: true });
    }
    fs.writeFileSync(pnlLogPath, JSON.stringify(tracker.getSummary(), null, 2));

    // 6. Log Human-Readable Explanation (UX Alignment)
    console.log(`\n${formatExplanation(decision)}\n`);

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

    // Sign the intent using EIP-712 via RiskRouterClient
    const signature = await riskRouterClient.signIntent(intent, privateKey);

    // ✅ NEW: Submit signed intent to RiskRouter for on-chain validation
    console.error(JSON.stringify({
      level: "INFO",
      step: "SUBMITTING_TO_RISKROUTER",
      TRACE_ID: traceId,
      contractAddress: config.riskRouter,
      timestamp: new Date().toISOString()
    }));

    const authResult = await riskRouterClient.authorizeTrade(intent, signature, privateKey);

    if (!authResult.success) {
      console.error(JSON.stringify({
        level: "ERROR",
        step: "RISKROUTER_AUTHORIZATION_FAILED",
        TRACE_ID: traceId,
        error: authResult.error,
        timestamp: new Date().toISOString()
      }));
      return { 
        isAllowed: false, 
        reason: `RiskRouter validation failed: ${authResult.error}`, 
        signature: '0x' 
      };
    }

    // Wait for transaction confirmation and TradeAuthorized event
    if (authResult.transactionHash) {
      console.error(JSON.stringify({
        level: "INFO",
        step: "WAITING_FOR_RISKROUTER_CONFIRMATION",
        TRACE_ID: traceId,
        txHash: authResult.transactionHash,
        timestamp: new Date().toISOString()
      }));

      const confirmation = await riskRouterClient.waitForTradeAuthorization(authResult.transactionHash);

      if (!confirmation.authorized) {
        console.error(JSON.stringify({
          level: "ERROR",
          step: "RISKROUTER_CONFIRMATION_FAILED",
          TRACE_ID: traceId,
          reason: confirmation.reason,
          timestamp: new Date().toISOString()
        }));
        return { 
          isAllowed: false, 
          reason: `RiskRouter did not authorize trade: ${confirmation.reason}`, 
          signature: '0x' 
        };
      }
    }

    console.error(JSON.stringify({
      level: "INFO",
      step: "RISKROUTER_AUTHORIZED",
      TRACE_ID: traceId,
      txHash: authResult.transactionHash,
      pair: intent.pair,
      amount: intent.amountUsdScaled.toString(),
      timestamp: new Date().toISOString()
    }));

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
  const agentMetadata = getAgentMetadata();
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
    amountUsdScaled: 10000n, // 00.00
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

  // Output PnL summary on completion
  const summary = getPnLTracker().getSummary();
  console.log("\n--- FINAL PnL SUMMARY ---");
  console.log(JSON.stringify(summary.summary, null, 2));
}

/**
 * @dev Main entry point check.
 * Ensures main() only runs when the script is executed directly.
 */
const isMain = import.meta.url === `file://${fileURLToPath(import.meta.url)}` ||
               (process.argv[1] && (
                 path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
                 process.argv[1].endsWith('agent_brain.ts')
               ));

if (isMain && process.env.NODE_ENV !== 'test') {
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
