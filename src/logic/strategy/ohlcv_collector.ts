import { logger } from '../../utils/logger.js';
import { getMcpClient } from './risk_assessment.js';

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
   * @dev Collects the latest 1m data for a pair.
   * Since the current MCP doesn't have a direct OHLCV tool, we approximate
   * by sampling the ticker or using the get_ticker data.
   */
  public async collect(pair: string) {
    try {
      const client = await getMcpClient();
      const response = await client.callTool({
        name: 'get_ticker',
        arguments: { symbol: pair }
      }) as { content: Array<{ type: string; text: string }> };

      const ticker = JSON.parse(response.content[0].text);

      const latest: OHLCV = {
        timestamp: Date.now(),
        open: parseFloat(ticker.o || ticker.c[0]), // Using open or last trade as fallback
        high: parseFloat(ticker.h[0]),
        low: parseFloat(ticker.l[0]),
        close: parseFloat(ticker.c[0]),
        volume: parseFloat(ticker.v[0])
      };

      const pairHistory = this.history.get(pair) || [];
      pairHistory.push(latest);

      if (pairHistory.length > this.MAX_HISTORY) {
        pairHistory.shift();
      }

      this.history.set(pair, pairHistory);
      logger.debug({ module: 'OHLCVCollector', step: 'COLLECTED', pair, count: pairHistory.length });
    } catch (error) {
      logger.warn({ module: 'OHLCVCollector', step: 'COLLECTION_FAILED', pair, error: error instanceof Error ? error.message : String(error) });
    }
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
