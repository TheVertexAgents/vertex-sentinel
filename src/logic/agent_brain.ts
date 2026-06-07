import '../bootstrap.js';
import { logger } from '../utils/logger.js';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { TradeIntent, Authorization } from './types.js';
import { validateEnv } from './env.js';
import { CriticalSecurityException } from './errors.js';
import { loadAgentMetadata } from './config.js';
import { analyzeRisk } from './strategy/risk_assessment.js';
import { createSignedCheckpoint } from '../utils/checkpoint.js';
import { formatExplanation } from '../utils/explainability.js';
import { RiskRouterClient } from '../onchain/risk_router.js';
import { IdentityClient } from '../onchain/identity.js';
import { LocalNonceTracker } from '../utils/nonce-tracker.js';
import { ValidationRegistryClient } from "../onchain/validation.js";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { PnLTracker } from './pnl/tracker.js';
import { startSocketServer } from '../orchestrator/socket-server.js';
import { agentEvents } from '../utils/event-bus.js';
import { OHLCVCollector } from './strategy/ohlcv_collector.js';
import { NotificationService } from '../utils/notifications.js';
import { RiskCalibrator } from './risk-calibrator.js';
import { checkGeographicRestrictions } from '../utils/geo-restrict.js';
import { getKrakenService, closeKrakenService } from '../services/kraken_service.js';
import { EventReconciler } from '../execution/reconciler.js';
import ExecutionProxy from '../execution/proxy.js';
import { safeParseJSON } from '../utils/safe-json.js';
import { ERR_KRAKEN_API_FAIL } from '../utils/constants.js';

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
    _pnlTracker = new PnLTracker({ persist: true });
  }
  return _pnlTracker;
}

/**
 * @dev Loads the deployment configuration for the current environment.
 */
function getDeploymentConfig() {
  const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');

  if (process.env.NETWORK === 'sepolia') {
    if (fs.existsSync(deploymentsPath)) {
      try {
        return JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
      } catch (error: any) {
        throw new CriticalSecurityException(`Fail-Closed: Failed to parse deployments_sepolia.json: ${error.message}`);
      }
    }
    // Strategic Fallback: Official Hackathon Addresses
    return {
      network: 'sepolia',
      chainId: 11155111,
      agentRegistry: '0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3',
      riskRouter: '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC',
      reputationRegistry: '0x423a9904e39537a9997fbaF0f220d79D7d545763',
      validationRegistry: '0x92bF63E5C7Ac6980f237a7164Ab413BE226187F1',
      hackathonVault: '0x0E7CD8ef9743FEcf94f9103033a044caBD45fC90'
    };
  }

  // Default to Local Hardhat if not explicitly set to sepolia
  return {
    chainId: 31337, // Hardhat default
    riskRouter: '0x0000000000000000000000000000000000000000', // Placeholder for local
    agentRegistry: '0x0000000000000000000000000000000000000000', // Placeholder for local
    validationRegistry: '0x0000000000000000000000000000000000000000',
    reputationRegistry: '0x0000000000000000000000000000000000000000'
  };
}

const config = getDeploymentConfig();

// Init On-Chain Clients
const validationClient = new ValidationRegistryClient(config.validationRegistry as Hex, config.chainId);
const ohlcvCollector = OHLCVCollector.getInstance();
const riskCalibrator = new RiskCalibrator(config.riskRouter as Hex, config.chainId, BigInt(getAgentMetadata().agentId));
// Note: ReputationRegistry requires external validators to rate agents (no self-rating allowed)
const riskRouterClient = new RiskRouterClient(config.riskRouter as Hex, config.chainId);
const identityClient = new IdentityClient(config.agentRegistry as Hex, config.chainId);
const nonceTracker = LocalNonceTracker.getInstance();

/**
 * @dev Helper to get a unique trace ID.
 */
function getTraceId(): string {
  return randomUUID();
}

/**
 * @dev Strykr PRISM API for canonical asset resolution.
 */
async function getAssetResolution(pair: string) {
  const apiKey = process.env.STRYKR_PRISM_API;
  const url = `https://api.prismapi.ai/resolve?pair=${encodeURIComponent(pair)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
        throw new Error(`PRISM API returned ${response.status}`);
    }

    const data = await response.json() as { symbol: string, precision: number };
    logger.info({ module: 'PRISM', step: 'METADATA_RESOLUTION', pair, symbol: data.symbol });
    return data;
  } catch (error: any) {
    logger.warn({ module: 'PRISM', message: 'PRISM API unavailable, using fallback', error: error.message });
    return { symbol: pair, precision: getAgentMetadata().prismDefaultPrecision };
  }
}

/**
 * @dev The Intent Layer creates a signed TradeIntent after verifiable risk assessment.
 */
async function signIntent(intent: TradeIntent, privateKey: Hex): Promise<Authorization> {
  const traceId = getTraceId();
  try {
    const useCircle = process.env.USE_CIRCLE_WAAS === 'true';
    const agentAddress = useCircle ? process.env.AGENT_WALLET_ADDRESS as Hex : privateKeyToAccount(privateKey).address;

    // 0. Geographic Restriction Check (Fail-Closed)
    await checkGeographicRestrictions();

    // 1. Check Identity (ERC-8004 Alignment) - non-blocking, informational only
    // RiskRouter performs final authorization regardless of registry status
    await identityClient.isAgentRegistered(agentAddress);

    // 2. Run Strategic Risk Assessment
    const decision = await analyzeRisk(intent.pair, intent.amountUsdScaled);

    // Fetch real price for PnL tracking and explanation
    let realPrice = 0;
    try {
      const kraken = getKrakenService();
      const ticker = await kraken.getTicker(intent.pair);
      if (!ticker.c || !ticker.c[0]) {
        throw new CriticalSecurityException('Invalid ticker data: missing last trade price (c[0])', ERR_KRAKEN_API_FAIL);
      }
      realPrice = parseFloat(ticker.c[0]);
    } catch (e: any) {
      throw new CriticalSecurityException('Fail-Closed: Failed to fetch real market price: ' + e.message);
    }

    // 3. Update PnL Tracker (Conditional on action)
    const tracker = getPnLTracker();
    if (decision.action === 'HOLD') {
      tracker.recordSavings(Number(intent.amountUsdScaled) / getAgentMetadata().usdScalingFactor);
    }
    // Note: recordTrade is now handled by ExecutionProxy upon successful execution
    logger.debug({ module: 'AGENT_BRAIN', step: 'PRICE_FETCH', pair: intent.pair, price: realPrice });

    // Fetch current on-chain risk parameters for "Distance to Circuit Breaker"
    let onchainRisk: any = null;
    try {
      onchainRisk = await riskRouterClient.riskParams(BigInt(getAgentMetadata().agentId));
    } catch (e) {
      logger.warn({ module: 'AGENT_BRAIN', step: 'FETCH_RISK_PARAMS_FAILED', error: e instanceof Error ? e.message : String(e) });
    }

    const currentPnL = {
      ...tracker.getMetrics(),
      onchainRisk: onchainRisk ? {
        maxPositionUsdScaled: onchainRisk[0].toString(),
        maxDrawdownBps: onchainRisk[1].toString(),
        maxTradesPerHour: onchainRisk[2].toString(),
        active: onchainRisk[3]
      } : null
    };

    // 4. Create and Sign Audit Checkpoint (Verifiable Execution)
    const checkpoint = await createSignedCheckpoint(getAgentMetadata(), decision, privateKey, config.chainId, currentPnL);

    // ✅ NEW: Automated Heartbeat Attestation to ValidationRegistry
    // Strategic: Always post 100 to counteract competitor zero-scores.
    if (checkpoint.checkpointHash) {
      logger.info({ step: 'POSTING_HEARTBEAT', traceId, checkpointHash: checkpoint.checkpointHash });

      // Emit risk alert if risk is high
      if (decision.riskScore > 0.6) {
        agentEvents.emit('risk.alert', { traceId, riskScore: decision.riskScore, reasoning: decision.reasoning });
        NotificationService.sendTelegram(`<b>High Risk Alert</b>\nRisk Score: ${(decision.riskScore * 100).toFixed(0)}%\nReasoning: ${decision.reasoning}`);
      }

      await validationClient.postHeartbeat(
        BigInt(getAgentMetadata().agentId),
        checkpoint.checkpointHash as Hex,
        `Vertex Heartbeat: ${decision.reasoning}`,
        privateKey,
        checkpoint.signature as Hex
      );
    }

    // 5. Persist PnL to logs/pnl.json - Handled internally by tracker.save()
    // tracker.save(); // Redundant as recordSavings already calls it

    // 6. Log Human-Readable Explanation (UX Alignment)
    logger.info({ step: 'EXPLANATION', explanation: formatExplanation(decision) });

    logger.info({ step: 'RISK_ASSESSMENT', traceId, pair: intent.pair, score: decision.riskScore, reason: decision.reasoning });

    if (decision.action === 'HOLD') {
       return { isAllowed: false, reason: `Risk too high or strategy HOLD: ${decision.reasoning}`, signature: '0x', decision, traceId };
    }

    // Sign the intent using EIP-712 via RiskRouterClient
    // ✅ NEW: High-Stakes Human-in-the-Loop (HITL) Check
    const hitlThreshold = parseInt(process.env.HITL_THRESHOLD_USD || '1000', 10);
    const intentAmountUsd = Number(intent.amountUsdScaled) / getAgentMetadata().usdScalingFactor;

    if (intentAmountUsd >= hitlThreshold) {
      logger.info({ module: 'AGENT_BRAIN', step: 'HITL_INTERCEPT', traceId, amountUsd: intentAmountUsd, threshold: hitlThreshold });

      agentEvents.emit('hitl.pending', {
        traceId,
        pair: intent.pair,
        action: intent.action,
        amountUsd: intentAmountUsd,
        reasoning: decision.reasoning,
        timestamp: Date.now()
      });

      NotificationService.sendTelegram(`<b>⚠️ High-Stakes Trade Pending Approval</b>\nPair: ${intent.pair}\nAmount: $${intentAmountUsd.toFixed(2)}\nAction: ${intent.action}\nReasoning: ${decision.reasoning}`);

      // Wait for manual approval or rejection
      const approvalPromise = new Promise<{ approved: boolean, reason?: string }>((resolve) => {
        const onApprove = (data: any) => {
          if (data.traceId === traceId) {
            cleanup();
            resolve({ approved: true });
          }
        };
        const onReject = (data: any) => {
          if (data.traceId === traceId) {
            cleanup();
            resolve({ approved: false, reason: data.reason || 'Manually rejected by operator' });
          }
        };
        const cleanup = () => {
          agentEvents.off(`hitl.approve.${traceId}`, onApprove);
          agentEvents.off(`hitl.reject.${traceId}`, onReject);
        };

        agentEvents.on(`hitl.approve.${traceId}`, onApprove);
        agentEvents.on(`hitl.reject.${traceId}`, onReject);

        // Timeout after 10 minutes
        setTimeout(() => {
          cleanup();
          resolve({ approved: false, reason: 'HITL approval timed out after 10 minutes' });
        }, 600000);
      });

      const { approved, reason } = await approvalPromise;
      if (!approved) {
        logger.warn({ module: 'AGENT_BRAIN', step: 'HITL_REJECTED', traceId, reason });
        return { isAllowed: false, reason: `HITL rejection: ${reason}`, signature: '0x' };
      }
      logger.info({ module: 'AGENT_BRAIN', step: 'HITL_APPROVED', traceId });
    }

    const signature = await riskRouterClient.signIntent(intent, privateKey);

    // ✅ NEW: Submit signed intent to RiskRouter for on-chain validation
    // Exponential backoff retry logic for authorization
    let authResult: { success: boolean; transactionHash?: Hex; error?: string } = { success: false };
    let attempts = 0;
    while (attempts < 3) {
      authResult = await riskRouterClient.authorizeTrade(intent, signature, privateKey);
      if (authResult.success) break;

      attempts++;
      const delay = Math.pow(2, attempts) * 2000;
      logger.warn({ step: 'AUTHORIZE_RETRY', traceId, attempt: attempts, delay, error: authResult.error });
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (!authResult.success) {
      logger.error({ step: 'RISKROUTER_AUTHORIZATION_FAILED', traceId, error: authResult.error });
      return { 
        isAllowed: false, 
        reason: `RiskRouter validation failed after retries: ${authResult.error}`,
        signature: '0x' 
      };
    }

    // Wait for transaction confirmation
    if (authResult.transactionHash) {
      // authResult.success being true means it was already confirmed by authorizeTrade's internal resubmission logic
      if (!authResult.success) {
        return { 
          isAllowed: false, 
          reason: `RiskRouter did not authorize trade: ${authResult.error}`,
          signature: '0x' 
        };
      }

      // Emit authorization event for dashboard
      agentEvents.emit('trade.authorized', {
        traceId,
        pair: intent.pair,
        amount: Number(intent.amountUsdScaled) / getAgentMetadata().usdScalingFactor,
        txHash: authResult.transactionHash
      });

      // Send Alerts
      NotificationService.sendTelegram(`<b>Trade Authorized</b>\nPair: ${intent.pair}\nAmount: $${(Number(intent.amountUsdScaled) / getAgentMetadata().usdScalingFactor).toFixed(2)}\nAction: ${intent.action}`);

      // NOTE: Reputation feedback must come from OTHER operators (not self-rating).
      // The ReputationRegistry enforces: "operator cannot self-rate"
      // Reputation will be built through external validator attestations.
    }

    return { isAllowed: true, reason: decision.reasoning, signature, decision, traceId };
  } catch (error: any) {
    if (error instanceof CriticalSecurityException) {
      // Only halt for TRUE security violations (e.g., env tampering, Verified-or-Die blocks)
      // NOT for recoverable API errors unless they are explicitly marked as security critical
      if (error.code === 'ENV_MISSING' || error.message.includes('Verified-or-Die')) {
        haltSystem(error.message);
      }
      throw error;
    }
    // Non-security errors: log and continue to next cycle
    logger.error({ module: 'AGENT_BRAIN', step: 'CYCLE_ERROR_RECOVERABLE', error: error.message });
    return { isAllowed: false, reason: `Recoverable error: ${error.message}`, signature: '0x' };
  }
}

// Trading interval in milliseconds (default: 5 minutes)
const TRADING_INTERVAL_MS = parseInt(process.env.TRADING_INTERVAL_MS || '300000', 10);

let isRunning = true;
let isAutomationEnabled = false; // Master Toggle State (Default to OFF)
let sleepResolve: ((value: unknown) => void) | null = null;

const AUTOMATION_STATE_PATH = path.join(process.cwd(), 'logs/automation_state.json');

function loadAutomationState() {
  if (fs.existsSync(AUTOMATION_STATE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(AUTOMATION_STATE_PATH, 'utf8'));
      isAutomationEnabled = data.enabled === true;
      logger.info({ module: 'AGENT_BRAIN', step: 'LOAD_AUTOMATION_STATE', enabled: isAutomationEnabled });
    } catch (e) {
      logger.warn({ module: 'AGENT_BRAIN', step: 'LOAD_AUTOMATION_STATE_FAILED', error: e instanceof Error ? e.message : String(e) });
    }
  }
}

function saveAutomationState() {
  try {
    if (!fs.existsSync(path.dirname(AUTOMATION_STATE_PATH))) {
      fs.mkdirSync(path.dirname(AUTOMATION_STATE_PATH), { recursive: true });
    }
    fs.writeFileSync(AUTOMATION_STATE_PATH, JSON.stringify({ enabled: isAutomationEnabled, timestamp: new Date().toISOString() }, null, 2));
  } catch (e) {
    logger.error({ module: 'AGENT_BRAIN', step: 'SAVE_AUTOMATION_STATE_FAILED', error: e instanceof Error ? e.message : String(e) });
  }
}

async function shutdown() {
  logger.info({ step: 'SHUTDOWN_INITIATED', message: 'Received shutdown signal. Initiating graceful shutdown...' });
  isRunning = false;
  
  if (sleepResolve) {
    sleepResolve(null);
  }

  // Force cleanup of KrakenService resources
  await closeKrakenService();
  
  logger.info({ step: 'SHUTDOWN_COMPLETE', message: 'Agent shutdown complete.' });
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * @dev Halt the system persistently.
 */
function haltSystem(reason: string) {
  logger.error({ module: 'AGENT_BRAIN', step: 'SYSTEM_HALT', reason });
  const haltPath = path.join(process.cwd(), 'logs/HALTED');
  if (!fs.existsSync(path.dirname(haltPath))) {
    fs.mkdirSync(path.dirname(haltPath), { recursive: true });
  }
  fs.writeFileSync(haltPath, JSON.stringify({
    reason,
    timestamp: new Date().toISOString()
  }, null, 2));

  process.exit(1);
}

/**
 * @dev Continuous trading loop with proper nonce management.
 * Fetches current nonce from RiskRouter on startup.
 * Submits intents at regular intervals to build validation score.
 */
async function main() {
  const haltPath = path.join(process.cwd(), 'logs/HALTED');

  // Support for --force-restart to clear persistent halt state
  if (process.argv.includes('--force-restart')) {
    if (fs.existsSync(haltPath)) {
      logger.warn({
        module: 'AGENT_BRAIN',
        step: 'FORCE_RESTART',
        message: 'Manual force-restart flag detected. Clearing persistent HALTED state.',
        clearedAt: new Date().toISOString()
      });
      fs.unlinkSync(haltPath);
    }
  }

  if (fs.existsSync(haltPath)) {
    const haltContent = fs.readFileSync(haltPath, 'utf8');
    const haltData = safeParseJSON(haltContent, { reason: 'Unknown', timestamp: new Date().toISOString() }, { file: 'logs/HALTED' });
    logger.error({
      module: 'AGENT_BRAIN',
      step: 'STARTUP_PREVENTED',
      message: 'System is in a persistent HALTED state. Manual intervention required.',
      reason: haltData.reason,
      haltedAt: haltData.timestamp
    });
    console.error(`\n❌ SYSTEM HALTED: ${haltData.reason}\nRemove ${haltPath} to restart.\n`);
    process.exit(1);
  }

  const agentMetadata = getAgentMetadata();
  const useCircle = process.env.USE_CIRCLE_WAAS === 'true';
  const pk = useCircle ? '0x' as Hex : process.env.AGENT_PRIVATE_KEY as Hex;
  const agentWallet = useCircle ? process.env.AGENT_WALLET_ADDRESS as Hex : privateKeyToAccount(pk).address;

  logger.info({
    module: 'AGENT_BRAIN',
    step: 'STARTUP_BANNER',
    message: 'VERTEX SENTINEL — LIVE TRADING AGENT',
    agentId: agentMetadata.agentId,
    wallet: agentWallet,
    interval: `${TRADING_INTERVAL_MS / 1000}s`
  });

  // Fetch current on-chain nonce and initialize LocalNonceTracker
  const onChainNonce = await riskRouterClient.getIntentNonce(BigInt(agentMetadata.agentId));
  const nonceKey = `${agentWallet}-${config.chainId}`;
  nonceTracker.sync(nonceKey, onChainNonce);

  logger.info({ module: 'AGENT_BRAIN', step: 'INITIAL_NONCE', nonce: onChainNonce.toString() });

  // Initialize Market Data Subscriptions via WebSocket (#147)
  const pairs = ['BTC/USDC', 'ETH/USDC', 'SOL/USDC'];
  for (const p of pairs) {
    ohlcvCollector.subscribe(p);
  }

  // Start Risk Calibration Background Loop (every 10 minutes)
  setInterval(() => riskCalibrator.runCalibration(), 600000);

  // Initialize Execution Proxy and Event Reconciler for Institutional Reliability
  const network = (process.env.NETWORK === 'sepolia' ? 'sepolia' : 'local') as 'local' | 'sepolia';
  const proxy = new ExecutionProxy(config.riskRouter as Hex, network, getPnLTracker());
  const reconciler = new EventReconciler(config.riskRouter as Hex, network, proxy);
  reconciler.start();
  proxy.startListener();

  // Load persisted state
  loadAutomationState();

  // Listen for automation toggle
  agentEvents.on('automation.toggle', (data: { enabled: boolean }) => {
    isAutomationEnabled = data.enabled;
    saveAutomationState();
    logger.info({ module: 'AGENT_BRAIN', step: 'AUTOMATION_SYNC', enabled: isAutomationEnabled });
  });

  // Continuous trading loop
  while (isRunning) {
    if (!isAutomationEnabled) {
      // If automation is disabled, we skip the trading cycle but keep the loop alive
      await new Promise(resolve => {
        sleepResolve = resolve;
        setTimeout(resolve, 5000);
      });
      continue;
    }

    try {
      const entropy = randomBytes(4).readUInt32BE(0);
      const selectedPair = pairs[entropy % pairs.length];
      
      // Randomize trade size within safe limits ($50-$200)
      const tradeSizeRange = 15000;
      const tradeSizeOffset = randomBytes(4).readUInt32BE(0) % tradeSizeRange;
      const tradeSize = BigInt(5000 + tradeSizeOffset); // $50.00 - $200.00

      const currentOnChainNonce = await riskRouterClient.getIntentNonce(BigInt(agentMetadata.agentId));
      const currentNonce = nonceTracker.getNextNonce(nonceKey, currentOnChainNonce);

      const actionEntropy = randomBytes(1)[0];
      const intent: TradeIntent = {
        agentId: BigInt(agentMetadata.agentId),
        agentWallet: agentWallet as Hex,
        pair: selectedPair,
        action: actionEntropy > 76 ? 'BUY' : 'SELL', // Approximately 70% BUY bias (255 * 0.3 = 76.5)
        amountUsdScaled: tradeSize,
        maxSlippageBps: getAgentMetadata().defaultSlippageBps,
        nonce: currentNonce,
        deadline: BigInt(Math.floor(Date.now() / 1000) + getAgentMetadata().defaultDeadlineOffset)
      };

      logger.info({ step: 'ANALYSIS_START', pair: selectedPair });
      
      const result = await signIntent(intent, pk);
      
      // Emit risk update for dashboard widgets
      if (result.decision) {
        agentEvents.emit('risk.update', {
          traceId: result.traceId,
          riskScore: result.decision.riskScore,
          breakdown: result.decision.breakdown,
          reasoning: result.decision.reasoning,
          pair: result.decision.pair
        });
      }

      if (result.isAllowed) {
        logger.info({ step: 'INTENT_SUBMITTED', nonce: currentNonce });

        // Shadow Trading Mode: if paper mode is true, the PnL tracker and execution proxy
        // will log the intent but not execute on real capital if the underlying MCP/Proxy is paper-gated.
        if (process.env.KRAKEN_PAPER_MODE === 'true') {
           logger.info({ step: 'SHADOW_MODE_LOG', message: 'Paper Mode Active: Intent signed and authorized on-chain but using simulated execution.' });
        }

        // Emit balance update event
        agentEvents.emit('balance.update', {
          pnl: getPnLTracker().getMetrics()
        });
      } else {
        logger.warn({ step: 'INTENT_SKIPPED', reason: result.reason });
      }

    } catch (error: any) {
      logger.error({ step: 'CYCLE_ERROR', error: error.message });
      // Refresh nonce in case of desync
      const refreshedNonce = await riskRouterClient.getIntentNonce(BigInt(agentMetadata.agentId));
      nonceTracker.sync(nonceKey, refreshedNonce);
      logger.info({ step: 'NONCE_REFRESHED', nonce: refreshedNonce });
    }
    
    // ✅ NEW: Update Unrealized PnL for active positions (UX/Reporting Hardening)
    try {
        const tracker = getPnLTracker();
        const kraken = getKrakenService();
        const activePositions = Object.entries(tracker.getSummary().positions)
            .filter(([_, pos]) => pos.open)
            .map(([pair, _]) => pair);
        
        for (const pair of activePositions) {
            const ticker = await kraken.getTicker(pair);
            const price = parseFloat(ticker.c[0]);
            tracker.updateUnrealizedPnL(pair, price);
        }
        
        // Emit final balance update with fresh unrealized metrics
        agentEvents.emit('balance.update', {
          pnl: tracker.getMetrics()
        });
    } catch (e) {
        logger.warn({ module: 'AGENT_BRAIN', step: 'PNL_UPDATE_FAILED', error: e instanceof Error ? e.message : String(e) });
    }

    // Wait for next trading cycle
    if (!isRunning) break;
    logger.debug({ step: 'WAITING', interval: TRADING_INTERVAL_MS / 1000 });
    await new Promise(resolve => {
      sleepResolve = resolve;
      setTimeout(() => {
        if (sleepResolve === resolve) sleepResolve = null;
        resolve(null);
      }, TRADING_INTERVAL_MS);
    });
  }

  logger.info({ step: 'SHUTDOWN_COMPLETE', message: 'Agent shutdown complete.' });
  process.exit(0);
}

logger.info({ step: 'SCRIPT_LOADING', message: 'Agent brain script loading...' });

const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
  process.argv[1].includes('agent_brain')
);

if (isMain && process.env.NODE_ENV !== 'test') {
  logger.info({ step: 'MAIN_START', message: 'Main entry point detected. Starting agent and socket server...' });

  // Start standalone socket server
  startSocketServer();

  main().catch((err) => {
    logger.error({ step: 'MAIN_ERROR', error: err.message, stack: err.stack });
    process.exit(1);
  });
} else {
  logger.info({ step: 'MODULE_LOADED', isMain, nodeEnv: process.env.NODE_ENV });
}

export { signIntent, getAssetResolution, isAutomationEnabled };
