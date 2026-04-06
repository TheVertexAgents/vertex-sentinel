import { PnLCalculator } from './calculator.js';
import { PnLTrackerConfig, Trade, Position, PnLMetrics, PnLSummary } from './types.js';

export class PnLTracker {
  private config: Required<PnLTrackerConfig>;
  private trades: Trade[] = [];
  private positions: Map<string, Position> = new Map();
  private realizedPnL: number = 0;
  private totalInvested: number = 0;

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

        position.open = false;
        position.unrealizedPnL = 0;
        position.currentPrice = trade.price;
      }
    }

    this.trades.push(fullTrade);
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
      console.warn(`[PnLTracker] Failed to update unrealized PnL for ${pair}: `, error);
    }
  }

  getMetrics(): PnLMetrics {
    const unrealizedPnL = Array.from(this.positions.values())
      .filter(p => p.open)
      .reduce((sum, p) => sum + p.unrealizedPnL, 0);

    const tradeResults = this.trades
      .filter(t => t.realizedPnL !== undefined)
      .map(t => t.realizedPnL as number);

    return {
      totalTrades: this.trades.length,
      winRate: PnLCalculator.calculateWinRate(tradeResults),
      realizedPnL: this.realizedPnL,
      unrealizedPnL: unrealizedPnL,
      totalPnL: this.realizedPnL + unrealizedPnL,
      roiPercent: PnLCalculator.calculateROI(this.realizedPnL + unrealizedPnL, this.totalInvested)
    };
  }

  getSummary(): PnLSummary {
    return {
      timestamp: new Date().toISOString(),
      sessionId: 'session-' + Math.random().toString(36).substring(2, 10),
      summary: this.getMetrics(),
      positions: Object.fromEntries(this.positions),
      trades: this.trades
    };
  }
}
