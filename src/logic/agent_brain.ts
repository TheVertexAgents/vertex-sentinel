import * as dotenv from 'dotenv';
import { type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { validateEnv } from './env.js';
import { loadAgentMetadata } from './config.js';
import { CriticalSecurityException } from './errors.js';
import { type TradeIntent, type Authorization } from './types.js';
import { analyzeRisk } from './strategy/risk_assessment.js';
import { createSignedCheckpoint } from '../utils/checkpoint.js';
import { formatExplanation } from '../utils/explainability.js';
import { RiskRouterClient } from '../onchain/risk_router.js';
import { IdentityClient } from '../onchain/identity.js';
import { ValidationRegistryClient } from '../onchain/validation_registry.js';
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
    agentRegistry: '0x0000000000000000000000000000000000000000', // Placeholder for local
    validationRegistry: '0x0000000000000000000000000000000000000000' // Placeholder for local
  };
}

const config = getDeploymentConfig();

// Init On-Chain Clients
const riskRouterClient = new RiskRouterClient(config.riskRouter as Hex, config.chainId);
const identityClient = new IdentityClient(config.agentRegistry as Hex, config.chainId);
const validationClient = new ValidationRegistryClient(config.validationRegistry as Hex, config.chainId);

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
    const mockPrice = 67000; // Placeholder until integrated with real execution callback
    tracker.recordTrade({
      id: traceId,
      pair: intent.pair,
      side: decision.action as 'BUY' | 'SELL',
      price: mockPrice,
      amount: Number(intent.amountUsdScaled) / 100 / mockPrice,
      timestamp: new Date().toISOString()
    });

    const currentPnL = tracker.getMetrics();

    let intentHash: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';
    let signature: Hex = '0x';

    if (decision.action !== 'HOLD') {
        // Sign the intent using EIP-712 via RiskRouterClient
        signature = await riskRouterClient.signIntent(intent, privateKey);
        intentHash = riskRouterClient.computeIntentHash(intent);

        // Submit signed intent to RiskRouter for on-chain validation
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

        // Wait for confirmation
        if (authResult.transactionHash) {
          const confirmation = await riskRouterClient.waitForTradeAuthorization(authResult.transactionHash);
          if (!confirmation.authorized) {
            return {
              isAllowed: false,
              reason: `RiskRouter did not authorize trade: ${confirmation.reason}`,
              signature: '0x'
            };
          }
        }
    }

    // 4. Create and Sign Audit Checkpoint (Verifiable Execution)
    const checkpoint = await createSignedCheckpoint(
        getAgentMetadata(),
        decision,
        intentHash,
        mockPrice,
        config.agentRegistry,
        privateKey,
        config.chainId,
        currentPnL
    );

    // 5. Post checkpoint hash to ValidationRegistry for Leaderboard
    if (config.validationRegistry !== '0x0000000000000000000000000000000000000000') {
        const validationResult = await validationClient.postCheckpointAttestation(
            BigInt(getAgentMetadata().agentId),
            checkpoint.checkpointHash as Hex,
            Math.round(decision.confidence * 100),
            `${decision.action} ${decision.pair} @ $${mockPrice}`,
            privateKey
        );
        if (validationResult.success) {
            console.log(`[agent_brain] Checkpoint posted to ValidationRegistry: ${validationResult.transactionHash}`);
        }
    }

    // 6. Persist PnL to logs/pnl.json
    const pnlLogPath = path.join(process.cwd(), 'logs/pnl.json');
    if (!fs.existsSync(path.dirname(pnlLogPath))) {
        fs.mkdirSync(path.dirname(pnlLogPath), { recursive: true });
    }
    fs.writeFileSync(pnlLogPath, JSON.stringify(tracker.getSummary(), null, 2));

    // 7. Log Human-Readable Explanation (UX Alignment)
    console.log(`\n${formatExplanation(decision)}\n`);

    if (decision.action === 'HOLD') {
       return { isAllowed: false, reason: `Risk too high or strategy HOLD: ${decision.reasoning}`, signature: '0x' };
    }

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
    amountUsdScaled: 10000n, // 100.00
    maxSlippageBps: 100n,
    nonce: BigInt(Date.now()),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  };

  const pk = process.env.AGENT_PRIVATE_KEY as Hex;

  const auth = await signIntent(demoIntent, pk);
  console.log("--- AUTHORIZATION ARTIFACT ---");
  console.log(JSON.stringify(auth, null, 2));
  console.log("--- END ---");

  const summary = getPnLTracker().getSummary();
  console.log("\n--- FINAL PnL SUMMARY ---");
  console.log(JSON.stringify(summary.summary, null, 2));
}

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
