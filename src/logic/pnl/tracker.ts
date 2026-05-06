import { PnLCalculator } from './calculator.js';
import { PnLTrackerConfig, Trade, Position, PnLMetrics, PnLSummary } from './types.js';
import { logger } from '../../utils/logger.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
      exchangeName: config?.exchangeName ?? 'kraken',
      persist: config?.persist ?? false
    };
    if (this.config.persist) {
      this.load();
    }
  }

  private load() {
    const pnlPath = path.join(process.cwd(), 'logs/pnl.json');
    if (fs.existsSync(pnlPath)) {
      try {
        const content = fs.readFileSync(pnlPath, 'utf8');
        const data = JSON.parse(content);
        if (data.trades) this.trades = data.trades;
        if (data.positions) {
          // Re-hydrate the Map from the serialized object
          for (const [pair, pos] of Object.entries(data.positions)) {
            this.positions.set(pair, pos as Position);
          }
        }
        if (data.summary) {
          this.realizedPnL = data.summary.realizedPnL || 0;
          this.totalInvested = data.summary.totalInvested || 0;
          this.sentinelSavings = data.summary.sentinelSavings || 0;
          this.equityCurve = [0, this.realizedPnL];
        }
        logger.info({ module: 'PnLTracker', step: 'STATE_LOADED', trades: this.trades.length, positions: this.positions.size });
      } catch (e: any) {
        logger.warn({ module: 'PnLTracker', step: 'LOAD_FAILED', error: e.message });
      }
    }
  }

  save() {
    const pnlPath = path.join(process.cwd(), 'logs/pnl.json');
    const logsDir = path.dirname(pnlPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    try {
      fs.writeFileSync(pnlPath, JSON.stringify(this.getSummary(), null, 2));
      logger.debug({ module: 'PnLTracker', step: 'STATE_SAVED' });
    } catch (e: any) {
      logger.error({ module: 'PnLTracker', step: 'SAVE_FAILED', error: e.message });
    }
  }

  getConfig(): Required<PnLTrackerConfig> {
    return this.config;
  }

  recordTrade(trade: Omit<Trade, 'fee' | 'realizedPnL'>) {
    const feePercent = this.config.takerFeePercent;
    const fee = (trade.price * trade.amount) * (feePercent / 100);
    const fullTrade: Trade = { ...trade, fee };

    if (trade.side === 'BUY') {
      const existing = this.positions.get(trade.pair);
      if (existing && existing.open) {
        // Average In: Calculate weighted average entry price
        const totalAmount = existing.amount + trade.amount;
        const totalCost = (existing.entryPrice * existing.amount) + (trade.price * trade.amount);
        existing.entryPrice = totalCost / totalAmount;
        existing.amount = totalAmount;
        existing.currentPrice = trade.price;
        // Re-estimate unrealized PnL (rough approximation for fees)
        existing.unrealizedPnL = ((trade.price - existing.entryPrice) * totalAmount) - (fee * 2);
      } else {
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
      }
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
    this.save();
  }

  recordSavings(amountUsd: number) {
    this.sentinelSavings += amountUsd;
    logger.info({ module: 'PnLTracker', step: 'SAVINGS_RECORDED', amountUsd, totalSavings: this.sentinelSavings });
    this.save();
  }

  updateUnrealizedPnL(pair: string, currentPrice: number) {
    const position = this.positions.get(pair);
    if (!position || !position.open) return;

    position.currentPrice = currentPrice;
    const result = PnLCalculator.calculateTradePnL(
      position.entryPrice,
      currentPrice,
      position.amount,
      this.config.takerFeePercent
    );
    position.unrealizedPnL = result.netPnL;
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
      totalInvested: this.totalInvested,
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
