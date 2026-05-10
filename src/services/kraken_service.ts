import { kraken as KrakenExchange } from 'ccxt';
import {
  TickerSchema,
  OrderResultSchema,
  Ticker,
  Balance,
  TradeHistory,
  OrderParams,
  OrderResult
} from '../mcp/kraken/types.js';
import { validateEnv } from '../logic/env.js';
import { CriticalSecurityException } from '../logic/errors.js';
import { logger } from '../utils/logger.js';

/**
 * @title Kraken Service
 * @dev Direct CCXT wrapper for Kraken exchange interactions.
 * Replaces the MCP-over-stdio subprocess architecture.
 */
export class KrakenService {
  private static instance: KrakenService | null = null;
  private exchange: KrakenExchange;
  private apiKey: string;
  private apiSecret: string;
  private cache = new Map<string, { data: any; expiresAt: number }>();

  private constructor() {
    const env = validateEnv();
    this.apiKey = env.KRAKEN_API_KEY;
    this.apiSecret = env.KRAKEN_SECRET;

    this.exchange = new KrakenExchange({
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      nonce: () => Date.now() * 1000
    });
  }

  public static getInstance(): KrakenService {
    if (!KrakenService.instance) {
      KrakenService.instance = new KrakenService();
    }
    return KrakenService.instance;
  }

  /**
   * @dev Resets the singleton instance. Primarily for testing.
   */
  public static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      KrakenService.instance = null;
    }
  }

  private isPaperMode(): boolean {
    return process.env.KRAKEN_PAPER_MODE === 'true';
  }

  private log(event: string, data: Record<string, unknown>, level: 'info' | 'error' | 'warn' = 'info') {
    const logData = {
      module: 'KrakenService',
      event,
      ...data,
      timestamp: new Date().toISOString(),
    };
    if (level === 'error') logger.error(logData);
    else if (level === 'warn') logger.warn(logData);
    else logger.info(logData);
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) return entry.data as T;
    return null;
  }

  private setCache(key: string, data: any, ttlMs: number) {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 1; i <= attempts; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const isRetryable = error.message?.includes('ETIMEDOUT') ||
                          error.message?.includes('502') ||
                          error.message?.includes('503') ||
                          error.name === 'RequestTimeout' ||
                          error.name === 'ExchangeNotAvailable';

        if (i < attempts && isRetryable) {
          const delay = Math.pow(2, i) * 1000;
          this.log('retry', { attempt: i, delay, error: error.message }, 'warn');
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retry attempts reached');
  }

  public async getTicker(symbol: string): Promise<Ticker> {
    this.log('get_ticker', { symbol }, 'info');
    const ticker = await this.withRetry(() =>
      this.exchange.fetchTicker(symbol, { 'timeout': 10000 })
    );

    return TickerSchema.parse({
      symbol: symbol,
      a: [ticker.ask?.toString() || '0', '0', '0'],
      b: [ticker.bid?.toString() || '0', '0', '0'],
      c: [ticker.last?.toString() || '0', '0'],
      v: [ticker.baseVolume?.toString() || '0', ticker.baseVolume?.toString() || '0'],
      p: [ticker.vwap?.toString() || '0', ticker.vwap?.toString() || '0'],
      t: [Number((ticker as any).count || 0), Number((ticker as any).count || 0)],
      l: [ticker.low?.toString() || '0', ticker.low?.toString() || '0'],
      h: [ticker.high?.toString() || '0', ticker.high?.toString() || '0'],
      o: ticker.open?.toString() || '0'
    });
  }

  public async getBalance(): Promise<Balance> {
    const cached = this.getCached<Balance>('balance');
    if (cached) return cached;

    this.log('get_balance', {}, 'info');
    if (this.isPaperMode()) {
      return {
        "USDC": "100000.00",
        "BTC": "2.50",
        "ETH": "25.00",
        "SOL": "500.00"
      } as any;
    }

    const balance = await this.exchange.fetchBalance();
    let normalizedBalance: Record<string, string> = {};
    for (const [asset, info] of Object.entries(balance.total)) {
      if (info !== undefined && info !== null && Number(info) > 0) {
        normalizedBalance[asset] = info.toString();
      }
    }
    this.setCache('balance', normalizedBalance, 60000); // 60s TTL
    return normalizedBalance as any;
  }

  public async getTradeHistory(): Promise<TradeHistory> {
    const cached = this.getCached<TradeHistory>('trade_history');
    if (cached) return cached;

    this.log('get_trade_history', {}, 'info');
    if (this.isPaperMode()) {
      return { trades: {}, count: 0 } as any;
    }

    const trades = await this.exchange.fetchMyTrades();
    let tradesRecord: Record<string, Record<string, unknown>> = {};
    for (const trade of trades) {
      const id = trade.id || `t-${Date.now()}`;
      tradesRecord[id] = {
        ordertxid: trade.order,
        pair: trade.symbol,
        time: (trade.timestamp || Date.now()) / 1000,
        type: trade.side,
        ordertype: trade.type,
        price: trade.price?.toString() || '0',
        cost: trade.cost?.toString() || '0',
        fee: trade.fee?.cost?.toString() || '0',
        vol: trade.amount?.toString() || '0',
      };
    }

    const result = {
      trades: tradesRecord,
      count: trades.length,
    } as any;
    this.setCache('trade_history', result, 120000); // 120s TTL
    return result;
  }

  public async placeOrder(params: OrderParams): Promise<OrderResult> {
    this.log('place_order', { params: params as unknown as Record<string, unknown> }, 'info');

    if (this.isPaperMode()) {
      return OrderResultSchema.parse({
        action: params.side,
        order_id: `PAPER-${Date.now()}`,
        pair: params.symbol,
        price: params.price || 0,
        volume: params.amount,
        cost: (params.price || 0) * params.amount
      });
    }

    try {
      const order = await this.withRetry(() =>
        this.exchange.createOrder(
          params.symbol,
          params.type,
          params.side,
          params.amount,
          params.price,
          { 'timeout': 10000 }
        )
      );

      return OrderResultSchema.parse({
        descr: { order: `${params.side} ${params.amount} ${params.symbol} @ ${params.type}` },
        txid: [order.id]
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('order_error', { error: errorMessage }, 'error');
      throw new CriticalSecurityException(`Execution failure on Kraken API: ${errorMessage}`);
    }
  }

  public async close(): Promise<void> {
    this.log('service_close', { message: 'KrakenService closed' }, 'info');
  }
}

export function getKrakenService(): KrakenService {
  return KrakenService.getInstance();
}

export async function closeKrakenService(): Promise<void> {
  await KrakenService.getInstance().close();
}
