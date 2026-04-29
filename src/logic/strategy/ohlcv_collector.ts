import { logger } from '../../utils/logger.js';
import { KrakenWSClient } from '../../utils/kraken-ws.js';

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * @dev Granular OHLCV Data Collector for institutional-grade risk calibration.
 * Tracks 1m candles in-memory.
 */
export class OHLCVCollector {
  private static instance: OHLCVCollector;
  private history: Map<string, OHLCV[]> = new Map();
  private readonly MAX_HISTORY = 1440; // 24 hours of 1m candles

  private constructor() {}

  public static getInstance(): OHLCVCollector {
    if (!OHLCVCollector.instance) {
      OHLCVCollector.instance = new OHLCVCollector();
    }
    return OHLCVCollector.instance;
  }

  /**
   * @dev Subscribes to real-time market data via WebSocket (#147).
   */
  public subscribe(pair: string) {
    const wsClient = KrakenWSClient.getInstance();
    wsClient.subscribeTicker(pair, (tickerData: any) => {
      const latest: OHLCV = {
        timestamp: Date.now(),
        open: tickerData.open || tickerData.last,
        high: tickerData.high,
        low: tickerData.low,
        close: tickerData.last,
        volume: tickerData.volume
      };

      const pairHistory = this.history.get(pair) || [];

      // Update or push based on 1m window
      const lastCandle = pairHistory[pairHistory.length - 1];
      const now = Date.now();
      const oneMinute = 60000;

      if (lastCandle && now - lastCandle.timestamp < oneMinute) {
        // Update current candle
        lastCandle.high = Math.max(lastCandle.high, latest.high);
        lastCandle.low = Math.min(lastCandle.low, latest.low);
        lastCandle.close = latest.close;
        lastCandle.volume += latest.volume;
      } else {
        // New candle
        pairHistory.push(latest);
      }

      if (pairHistory.length > this.MAX_HISTORY) {
        pairHistory.shift();
      }

      this.history.set(pair, pairHistory);
      logger.debug({ module: 'OHLCVCollector', step: 'WS_UPDATED', pair, price: latest.close });
    });
  }

  /**
   * @dev Manual collection fallback (optional).
   * Polling is now deprecated in favor of WebSocket subscriptions.
   */
  public async collect(pair: string) {
     // No-op or log warning as it is replaced by subscribe
     logger.debug({ module: 'OHLCVCollector', step: 'COLLECT_DEPRECATED', pair });
  }

  public getHistory(pair: string): OHLCV[] {
    return this.history.get(pair) || [];
  }

  /**
   * @dev Calculates realized volatility over the collected period.
   */
  public calculateVolatility(pair: string): number {
    const history = this.getHistory(pair);
    if (history.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < history.length; i++) {
      returns.push(Math.log(history[i].close / history[i-1].close));
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(history.length); // Annualized approximation depends on period
  }
}
