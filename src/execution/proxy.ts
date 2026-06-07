import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import path from 'path';
import fs from 'fs';
import { orderManager } from './order-manager.js';
import { CriticalSecurityException } from '../logic/errors.js';
import { loadAgentMetadata } from '../logic/config.js';
import { logger } from '../utils/logger.js';
import { safeParseJSON } from '../utils/safe-json.js';
import { PnLTracker } from '../logic/pnl/tracker.js';
import { ERR_UNAUTHORIZED_AGENT, ERR_KRAKEN_API_FAIL, ERR_PRICE_INVALID, ERR_JSON_PARSE, ERR_CIRCUIT_BREAKER_OPEN } from '../utils/constants.js';

// Minimal ABI for the events we care about
const RISK_ROUTER_ABI = parseAbi([
  'event TradeAuthorized(bytes32 indexed intentHash, address indexed agent, string pair, string action, uint256 amountUsdScaled, uint256 maxSlippageBps)',
  'event TradeRejected(bytes32 indexed intentHash, string reason)',
]);

type Network = 'local' | 'sepolia';

/**
 * @title ExecutionProxy
 * @dev The "Execution Layer" proxy that monitors the RiskRouter for
 * TradeAuthorized events and executes orders on the exchange via modular MCP.
 * Strictly adheres to Project Constitution v2.0.0.
 */
class ExecutionProxy {
  private client;
  private contractAddress: `0x${string}`;
  private agentAddress: `0x${string}`;
  private auditLogPath = path.join(process.cwd(), 'logs/audit.json');
  private pnlTracker: PnLTracker | null;

  // Circuit Breaker State
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private circuitBreakerOpenUntil = 0;
  private readonly CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(contractAddress?: `0x${string}`, network: Network = 'sepolia', pnlTracker: PnLTracker | null = null) {
    this.pnlTracker = pnlTracker;
    // If contractAddress is not provided, try loading from deployments_sepolia.json if network is sepolia
    if (!contractAddress && network === 'sepolia') {
      const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');
      if (fs.existsSync(deploymentsPath)) {
        try {
          const content = fs.readFileSync(deploymentsPath, 'utf8');
          const deployments = safeParseJSON(content, {} as Record<string, string>, { file: 'deployments_sepolia.json' });
          this.contractAddress = deployments.riskRouter as `0x${string}`;
        } catch (error) {
          throw new CriticalSecurityException(`Fail-Closed: Failed to load deployments_sepolia.json: ${error instanceof Error ? error.message : String(error)}`, ERR_JSON_PARSE);
        }
      } else {
        // Strategic Fallback: Official Hackathon RiskRouter Address
        this.contractAddress = '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC';
      }
    } else {
      this.contractAddress = contractAddress || '0x0000000000000000000000000000000000000000';
    }

    this.client = createPublicClient({
      chain: network === 'sepolia' ? sepolia : hardhat,
      transport: http(
        network === 'sepolia'
          ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`
          : process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545'
      ),
    });

    const useCircle = process.env.USE_CIRCLE_WAAS === 'true';
    if (useCircle) {
        this.agentAddress = process.env.AGENT_WALLET_ADDRESS as Hex;
    } else {
        const pk = process.env.AGENT_PRIVATE_KEY as Hex;
        if (!pk) {
            throw new CriticalSecurityException('AGENT_PRIVATE_KEY is missing from environment');
        }
        this.agentAddress = privateKeyToAccount(pk).address;
    }

    this.log('INFO', 'Execution Layer Proxy Initialized', {
        network,
        contractAddress: this.contractAddress,
        agentAddress: this.agentAddress,
        chainId: network === 'sepolia' ? 11155111 : 31337
    });

    // Ensure logs directory exists
    const logsDir = path.dirname(this.auditLogPath);
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * @dev Structured JSON logging to stderr as mandated by Constitution v2.0.0.
   */
  private log(level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL', message: string, data: Record<string, unknown> = {}) {
    logger.error({
      level,
      module: 'ExecutionProxy',
      message,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * @dev Audit logging to JSONL file.
   */
  private auditLog(data: Record<string, unknown>) {
    const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        ...data
    });
    fs.appendFileSync(this.auditLogPath, entry + '\n');

    // Also mark as executed in reconciler DB if success
    if (data.krakenStatus === 'success' && data.traceId) {
        this.markExecutedInDb(data.traceId as string);
    }
  }

  private async markExecutedInDb(intentHash: string) {
      const dbPath = path.join(process.cwd(), 'logs/executed_intents.db');
      try {
          const sqlite3Module = await import('sqlite3');
          const sqlite3 = sqlite3Module.default;
          const db = new sqlite3.Database(dbPath);
          db.run('INSERT OR IGNORE INTO executed_intents (intent_hash) VALUES (?)', [intentHash], () => {
              db.close();
          });
      } catch (e) {
          // Non-fatal
      }
  }

  /**
   * @dev Starts listening for TradeAuthorized events from the on-chain RiskRouter.
   */
  async startListener() {
    this.log('INFO', 'Monitoring for TradeAuthorized events on-chain...');

    // Listen for authorized trades
    this.client.watchContractEvent({
      address: this.contractAddress,
      abi: RISK_ROUTER_ABI,
      eventName: 'TradeAuthorized',
      onLogs: (logs) => {
        for (const log of logs) {
          const { intentHash, agent, pair, action, amountUsdScaled, maxSlippageBps } = log.args as {
            intentHash: `0x${string}`;
            agent: `0x${string}`;
            pair: string;
            action: string;
            amountUsdScaled: bigint;
            maxSlippageBps: bigint;
          };

          this.log('INFO', 'TRADE AUTHORIZED ON-CHAIN', {
              intentHash,
              agent,
              pair,
              action,
              volume: amountUsdScaled.toString(),
              maxSlippageBps: maxSlippageBps.toString()
          });

          // Phase B: Agent ID Verification (Strict Check)
          if (agent.toLowerCase() !== this.agentAddress.toLowerCase()) {
              this.log('CRITICAL', 'SECURITY_BREACH_ATTEMPT: Unauthorized agent address in event', {
                  expected: this.agentAddress,
                  actual: agent,
                  intentHash,
                  errorCode: ERR_UNAUTHORIZED_AGENT
              });
              // Fail-Closed: Halt or ignore? Request says "halt"
              throw new CriticalSecurityException(`Security Breach: Unauthorized agent ${agent}`, ERR_UNAUTHORIZED_AGENT);
          }

          this.executeOrder(pair, amountUsdScaled, intentHash, action, maxSlippageBps).catch((err: any) => {
              this.log('ERROR', 'Background trade execution failed', { error: err.message });
          });
        }
      },
    });

    // Listen for rejected trades (for logging/alerting)
    this.client.watchContractEvent({
      address: this.contractAddress,
      abi: RISK_ROUTER_ABI,
      eventName: 'TradeRejected',
      onLogs: (logs) => {
        for (const log of logs) {
          const { intentHash, reason } = log.args as {
            intentHash: `0x${string}`;
            reason: string;
          };

          this.log('INFO', 'TRADE REJECTED BY SENTINEL', {
              intentHash,
              reason
          });
        }
      },
    });
  }

  /**
   * @dev Calls the Order Manager to execute an order across supported exchanges.
   * Implements "Fail-Closed" behavior and Slippage Enforcement.
   */
  private async executeOrder(pair: string, volume: bigint, traceId: string, action: string, maxSlippageBps: bigint, attempt: number = 1): Promise<void> {
    if (Date.now() < this.circuitBreakerOpenUntil) {
      this.log('CRITICAL', 'Circuit Breaker is OPEN. Trade blocked.', { TRACE_ID: traceId });
      throw new CriticalSecurityException('Circuit Breaker is OPEN', ERR_CIRCUIT_BREAKER_OPEN);
    }

    this.log('INFO', 'Submitting order via OrderManager...', { TRACE_ID: traceId, pair, volume: volume.toString(), action, maxSlippageBps: maxSlippageBps.toString() });
    
    try {
      const config = loadAgentMetadata();
      const amount = Number(volume) / config.usdScalingFactor;

      // Multi-exchange support: CCXT handles pairs like BTC/USDT or BTCUSDT
      const cleanSymbol = pair.includes('/') ? pair.replace('/', '') : pair;

      // Fetch ticker for reference price via BinanceAdapter (unified CCXT)
      const ticker = await orderManager.getBinanceAdapter().fetchTicker(cleanSymbol);
      const referencePrice = action.toLowerCase() === 'buy' ? ticker.ask : ticker.bid;

      if (!referencePrice || referencePrice <= 0) {
          throw new CriticalSecurityException(`Invalid or missing ticker data for ${cleanSymbol}`, 'EXCHANGE_ERROR');
      }

      // Calculate limit price based on slippage bps
      const slippageMultiplier = Number(maxSlippageBps) / 10000;
      let limitPrice: number;
      if (action.toLowerCase() === 'buy') {
        limitPrice = referencePrice * (1 + slippageMultiplier);
      } else {
        limitPrice = referencePrice * (1 - slippageMultiplier);
      }

      // Round to 8 decimal places for exchange compatibility
      limitPrice = Number(limitPrice.toFixed(8));
      const paddedAmount = Number(amount.toFixed(8));

      // Fail-Closed Validation
      if (!limitPrice || limitPrice <= 0 || !isFinite(limitPrice)) {
        throw new CriticalSecurityException(`Invalid calculated limitPrice: ${limitPrice} (Reference: ${referencePrice}, Slippage: ${maxSlippageBps})`, ERR_PRICE_INVALID);
      }

      this.log('INFO', 'Executing Limit Order via OrderManager', {
        TRACE_ID: traceId,
        referencePrice,
        calculatedLimitPrice: limitPrice,
        slippageBps: maxSlippageBps.toString(),
        side: action.toUpperCase()
      });

      const result = await orderManager.placeLimitOrder(cleanSymbol, action.toUpperCase() as 'BUY' | 'SELL', paddedAmount, limitPrice);

      const orderId = result.id || result.orderId || 'UNKNOWN';

      // Reset circuit breaker on success
      this.consecutiveFailures = 0;
      if (this.recoveryTimer) {
          clearTimeout(this.recoveryTimer);
          this.recoveryTimer = null;
      }

      // Update PnL Tracker if available
      if (this.pnlTracker) {
        this.pnlTracker.recordTrade({
            id: traceId,
            pair,
            side: action.toUpperCase() as 'BUY' | 'SELL',
            price: result.price || referencePrice,
            amount: paddedAmount,
            timestamp: new Date().toISOString()
        });
      }

      // Audit Logging
      this.auditLog({
          traceId,
          orderId,
          agentId: this.agentAddress,
          pair,
          volume: amount.toString(),
          executionPrice: result.price || 0,
          txHash: orderId,
          exchangeStatus: 'success'
      });

    } catch (error: any) {
      const config = loadAgentMetadata();
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any).code || 'EXCHANGE_ERROR';

      // Exponential Backoff for transient errors
      const isTransient = errorCode === 503 || errorCode === 429 || errorMessage.includes('503') || errorMessage.includes('429');
      if (isTransient && attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          this.log('WARN', `Transient exchange error (${errorCode}). Retrying in ${delay}ms...`, { TRACE_ID: traceId, attempt });
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeOrder(pair, volume, traceId, action, maxSlippageBps, attempt + 1);
      }
      
      this.consecutiveFailures++;

      // Emit alert on every failure
      agentEvents.emit('risk.alert', {
          type: 'EXECUTION_FAILURE',
          message: `Execution failed: ${errorMessage}`,
          traceId,
          consecutiveFailures: this.consecutiveFailures
      });

      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.circuitBreakerOpenUntil = Date.now() + this.CIRCUIT_BREAKER_COOLDOWN_MS;
        this.log('CRITICAL', 'CIRCUIT BREAKER TRIPPED OPEN', { TRACE_ID: traceId, consecutiveFailures: this.consecutiveFailures });
        this.auditLog({
            traceId,
            agentId: this.agentAddress,
            event: 'CIRCUIT_BREAKER_TRIPPED',
            consecutiveFailures: this.consecutiveFailures,
            breakerState: 'OPEN'
        });

        // Self-healing: Schedule recovery
        if (!this.recoveryTimer) {
            this.recoveryTimer = setTimeout(() => {
                this.log('INFO', 'Circuit Breaker Recovery: Attempting self-healing/reset.');
                this.consecutiveFailures = 0;
                this.circuitBreakerOpenUntil = 0;
                this.recoveryTimer = null;
            }, this.CIRCUIT_BREAKER_COOLDOWN_MS);
        }
      }

      this.log('CRITICAL', 'Order Execution Failed (Fail-Closed)', { TRACE_ID: traceId, errorCode, error: errorMessage, consecutiveFailures: this.consecutiveFailures });

      this.auditLog({
          traceId,
          agentId: this.agentAddress,
          pair,
          volume: (Number(volume) / config.usdScalingFactor).toString(),
          krakenStatus: 'failed',
          errorCode,
          error: errorMessage,
          consecutiveFailures: this.consecutiveFailures,
          breakerState: Date.now() < this.circuitBreakerOpenUntil ? 'OPEN' : 'CLOSED'
      });

      throw new CriticalSecurityException(`Execution failure: ${errorMessage}`, errorCode);
    }
  }

  /**
   * @dev Process an authorized trade intent directly (non-event path, for testing).
   */
  async processAuthorizedTrade(pair: string, volume: bigint, traceId: string = 'test-trace', action: string = 'buy', maxSlippageBps: bigint = 100n) {
    this.log('INFO', 'Processing direct trade authorization', { traceId, pair, volume: volume.toString() });
    await this.executeOrder(pair, volume, traceId, action, maxSlippageBps);
  }

  /**
   * @dev Formats volume for Kraken requirements
   */
  private formatKrakenVolume(volume: number): number {
    return Math.round(volume * 1e8) / 1e8;
  }

  /**
   * @dev Formats price for Kraken requirements
   */
  private formatKrakenPrice(price: number): number {
    return Math.round(price * 1e8) / 1e8;
  }
}

export default ExecutionProxy;
