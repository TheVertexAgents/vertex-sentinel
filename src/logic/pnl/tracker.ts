import { PnLCalculator } from './calculator.js';
import { PnLTrackerConfig, Trade, Position, PnLMetrics, PnLSummary } from './types.js';
import { logger } from '../../utils/logger.js';
import crypto from 'node:crypto';

export class PnLTracker {
  private config: Required<PnLTrackerConfig>;
  private trades: Trade[] = [];
  private positions: Map<string, Position> = new Map();
  private realizedPnL: number = 0;
  private totalInvested: number = 0;
  private sentinelSavings: number = 0;
  private equityCurve: number[] = [0];

  constructor(config?: PnLTrackerConfig) {
    this.config = {
      makerFeePercent: config?.makerFeePercent ?? 0.16,
      takerFeePercent: config?.takerFeePercent ?? 0.26,
      exchangeName: config?.exchangeName ?? 'kraken'
    };
  }

  getConfig(): Required<PnLTrackerConfig> {
    return this.config;
  }

  recordTrade(trade: Omit<Trade, 'fee' | 'realizedPnL'>) {
    const feePercent = this.config.takerFeePercent;
    const fee = (trade.price * trade.amount) * (feePercent / 100);
    const fullTrade: Trade = { ...trade, fee };

    if (trade.side === 'BUY') {
      const position: Position = {
        pair: trade.pair,
        open: true,
        entryPrice: trade.price,
        currentPrice: trade.price,
        amount: trade.amount,
        unrealizedPnL: -fee * 2, // Accounting for entry fee and projected exit fee
        entryTime: trade.timestamp
      };
      this.positions.set(trade.pair, position);
      this.totalInvested += (trade.price * trade.amount) + fee;
    } else if (trade.side === 'SELL') {
      const position = this.positions.get(trade.pair);
      if (position && position.open) {
        const result = PnLCalculator.calculateTradePnL(
          position.entryPrice,
          trade.price,
          trade.amount,
          feePercent
        );
        this.realizedPnL += result.netPnL;
        fullTrade.realizedPnL = result.netPnL;
        this.equityCurve.push(this.realizedPnL);

        position.open = false;
        position.unrealizedPnL = 0;
        position.currentPrice = trade.price;
      }
    }

    this.trades.push(fullTrade);
  }

  recordSavings(amountUsd: number) {
    this.sentinelSavings += amountUsd;
    logger.info({ module: 'PnLTracker', step: 'SAVINGS_RECORDED', amountUsd, totalSavings: this.sentinelSavings });
  }

  async updateUnrealizedPnL(pair: string, mcpClient: any) {
    const position = this.positions.get(pair);
    if (!position || !position.open) return;

    try {
      const response = await mcpClient.callTool('get_ticker', { symbol: pair });
      // The response structure might vary; assuming it matches what's used in signIntent
      // and according to the mock in tracker.test.ts
      const ticker = typeof response.content[0].text === 'string'
        ? JSON.parse(response.content[0].text)
        : response.content[0].text;

      // Kraken ticker 'c' field is [price, volume]
      const currentPrice = parseFloat(ticker.c[0]);
      position.currentPrice = currentPrice;

      const result = PnLCalculator.calculateTradePnL(
        position.entryPrice,
        currentPrice,
        position.amount,
        this.config.takerFeePercent
      );
      position.unrealizedPnL = result.netPnL;
    } catch (error) {
      logger.warn({ module: 'PnLTracker', step: 'UNREALIZED_UPDATE_FAILED', pair, error: error instanceof Error ? error.message : String(error) });
    }
  }

  getMetrics(): PnLMetrics {
    const unrealizedPnL = Array.from(this.positions.values())
      .filter(p => p.open)
      .reduce((sum, p) => sum + p.unrealizedPnL, 0);

    const tradeResults = this.trades
      .filter(t => t.realizedPnL !== undefined)
      .map(t => t.realizedPnL as number);

    const totalPnL = this.realizedPnL + unrealizedPnL;

    const totalExposureUsd = Array.from(this.positions.values())
      .filter(p => p.open)
      .reduce((sum, p) => sum + (p.amount * p.currentPrice), 0);

    // Update equity curve with current total PnL for live drawdown calculation
    const currentEquityCurve = [...this.equityCurve, totalPnL];

    return {
      totalTrades: this.trades.length,
      winRate: PnLCalculator.calculateWinRate(tradeResults),
      winLossRatio: PnLCalculator.calculateWinLossRatio(tradeResults),
      realizedPnL: this.realizedPnL,
      unrealizedPnL: unrealizedPnL,
      totalExposureUsd: totalExposureUsd,
      totalPnL: totalPnL,
      roiPercent: PnLCalculator.calculateROI(totalPnL, this.totalInvested),
      sentinelSavings: this.sentinelSavings,
      maxDrawdown: PnLCalculator.calculateMaxDrawdown(currentEquityCurve),
      sharpeRatio: PnLCalculator.calculateSharpeRatio(tradeResults)
    };
  }

  getSummary(): PnLSummary {
    return {
      timestamp: new Date().toISOString(),
      sessionId: 'session-' + crypto.randomUUID(),
      summary: this.getMetrics(),
      positions: Object.fromEntries(this.positions),
      trades: this.trades
    };
  }
}
