import sqlite3 from 'sqlite3';
import { createPublicClient, http, parseAbi, type Hex } from 'viem';
import { hardhat, sepolia, mainnet, base, arbitrum } from 'viem/chains';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import ExecutionProxy from './proxy.js';

const RISK_ROUTER_ABI = parseAbi([
  'event TradeAuthorized(bytes32 indexed intentHash, address indexed agent, string pair, string action, uint256 amountUsdScaled, uint256 maxSlippageBps)',
]);

/**
 * @title EventReconciler
 * @dev Persistent polling loop to ensure all TradeAuthorized events are executed.
 */
export class EventReconciler {
  private db: sqlite3.Database;
  private client: any;
  private proxy: ExecutionProxy;
  private contractAddress: Hex;
  private lastCheckedBlock: bigint = 0n;

  constructor(contractAddress: Hex, network: string = 'sepolia', proxy: ExecutionProxy) {
    const dbPath = path.join(process.cwd(), 'logs/executed_intents.db');
    const logsDir = path.dirname(dbPath);
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    this.db = new sqlite3.Database(dbPath);
    this.proxy = proxy;
    this.contractAddress = contractAddress;

    this.initDb();

    const chainMap: Record<string, any> = { sepolia, hardhat, mainnet, base, arbitrum };
    const chain = chainMap[network] || sepolia;

    this.client = createPublicClient({
      chain,
      transport: http(
        network === 'sepolia'
          ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`
          : process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545'
      ),
    });
  }

  private initDb() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS executed_intents (
        intent_hash TEXT PRIMARY KEY,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * @dev Main reconciliation loop.
   */
  async start() {
    logger.info({ module: 'Reconciler', message: 'Starting event reconciliation loop' });

    // Initialize lastCheckedBlock to current block minus 100
    try {
        this.lastCheckedBlock = await this.client.getBlockNumber() - 100n;
    } catch (e) {
        this.lastCheckedBlock = 0n;
    }

    setInterval(() => this.reconcile(), 60000); // Every 60 seconds
  }

  async reconcile() {
    try {
      const currentBlock = await this.client.getBlockNumber();
      if (currentBlock <= this.lastCheckedBlock) return;

      logger.info({ module: 'Reconciler', step: 'POLLING', fromBlock: this.lastCheckedBlock.toString(), toBlock: currentBlock.toString() });

      const logs = await this.client.getContractEvents({
        address: this.contractAddress,
        abi: RISK_ROUTER_ABI,
        eventName: 'TradeAuthorized',
        fromBlock: this.lastCheckedBlock,
        toBlock: currentBlock
      });

      for (const log of logs) {
        const { intentHash, pair, action, amountUsdScaled, maxSlippageBps } = log.args;

        const isExecuted = await this.checkExecuted(intentHash);
        if (!isExecuted) {
          logger.warn({ module: 'Reconciler', message: 'Found unexecuted intent, re-triggering...', intentHash });

          try {
            // Re-execute via proxy (this will log to audit.json and potentially retry)
            // Note: executeOnKraken is private in proxy.ts, so we use processAuthorizedTrade
            await this.proxy.processAuthorizedTrade(pair, amountUsdScaled, intentHash, action, maxSlippageBps);
            await this.markExecuted(intentHash);
          } catch (err: any) {
            logger.error({ module: 'Reconciler', message: 'Re-execution failed', intentHash, error: err.message });
          }
        }
      }

      this.lastCheckedBlock = currentBlock + 1n;
    } catch (error: any) {
      logger.error({ module: 'Reconciler', message: 'Reconciliation cycle failed', error: error.message });
    }
  }

  private checkExecuted(intentHash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT 1 FROM executed_intents WHERE intent_hash = ?', [intentHash], (err, row) => {
        if (err) reject(err);
        resolve(!!row);
      });
    });
  }

  private markExecuted(intentHash: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT OR IGNORE INTO executed_intents (intent_hash) VALUES (?)', [intentHash], (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
}
