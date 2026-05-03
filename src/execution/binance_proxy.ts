import { logger } from '../utils/logger.js';
import * as ccxt from 'ccxt';
import path from 'path';
import fs from 'fs';
import { CriticalSecurityException } from '../logic/errors.js';
import { loadAgentMetadata } from '../logic/config.js';

/**
 * @title BinanceProxy
 * @dev Modular execution for Binance.
 */
class BinanceProxy {
  private binance: any;
  private auditLogPath = path.join(process.cwd(), 'logs/audit.json');

  constructor() {
    const apiKey = process.env.BINANCE_API_KEY;
    const secret = process.env.BINANCE_SECRET;

    this.binance = new ccxt.binance({
      apiKey,
      secret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot'
      }
    });

    if (process.env.KRAKEN_PAPER_MODE === 'true') {
        this.binance.setSandboxMode(true);
    }
  }

  private auditLog(data: Record<string, unknown>) {
    const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        ...data
    });
    fs.appendFileSync(this.auditLogPath, entry + '\n');
  }

  async executeTrade(pair: string, volume: bigint, action: string) {
    const config = loadAgentMetadata();
    const amount = Number(volume) / config.usdScalingFactor;
    const symbol = pair; // ccxt handles unified symbols (e.g. BTC/USDC)

    logger.info({ module: 'BinanceProxy', step: 'SUBMIT_ORDER', symbol, action, amount });

    try {
      const order = await this.binance.createMarketOrder(symbol, action.toLowerCase() as 'buy' | 'sell', amount);

      this.auditLog({
          exchange: 'binance',
          orderId: order.id,
          pair,
          volume: amount.toString(),
          status: 'success'
      });

      return order;
    } catch (error: any) {
      this.auditLog({
          exchange: 'binance',
          pair,
          status: 'failed',
          error: error.message
      });
      throw new CriticalSecurityException(`Binance execution failed: ${error.message}`);
    }
  }
}

export default BinanceProxy;
