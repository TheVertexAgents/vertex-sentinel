import { expect } from 'chai';
import { PnLTracker } from '../../src/logic/pnl/tracker.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Vertex Sentinel — E2E PnL Scenario', () => {
  const tracker = new PnLTracker({
    makerFeePercent: 0.16,
    takerFeePercent: 0.26,
    exchangeName: 'kraken'
  });

  const trades = [
    // 1. Win: BTC Buy @ 60,000, Sell @ 61,000 (0.1 BTC) -> PnL: +100
    { side: 'BUY', pair: 'BTC/USD', price: 60000, amount: 0.1, timestamp: Date.now() - 3600000 * 5 },
    { side: 'SELL', pair: 'BTC/USD', price: 61000, amount: 0.1, timestamp: Date.now() - 3600000 * 4 },

    // 2. Loss: BTC Buy @ 62,000, Sell @ 61,500 (0.1 BTC) -> PnL: -50
    { side: 'BUY', pair: 'BTC/USD', price: 62000, amount: 0.1, timestamp: Date.now() - 3600000 * 3 },
    { side: 'SELL', pair: 'BTC/USD', price: 61500, amount: 0.1, timestamp: Date.now() - 3600000 * 2.5 },

    // 3. Win: BTC Buy @ 60,500, Sell @ 61,200 (0.2 BTC) -> PnL: +140
    { side: 'BUY', pair: 'BTC/USD', price: 60500, amount: 0.2, timestamp: Date.now() - 3600000 * 2 },
    { side: 'SELL', pair: 'BTC/USD', price: 61200, amount: 0.2, timestamp: Date.now() - 3600000 * 1.5 },

    // 4. Win: BTC Buy @ 61,000, Sell @ 61,500 (0.05 BTC) -> PnL: +25
    { side: 'BUY', pair: 'BTC/USD', price: 61000, amount: 0.05, timestamp: Date.now() - 3600000 * 1 },
    { side: 'SELL', pair: 'BTC/USD', price: 61500, amount: 0.05, timestamp: Date.now() - 3000000 },

    // 5. Win (Recovery): BTC Buy @ 60,000, Sell @ 60,800 (0.1 BTC) -> PnL: +80
    { side: 'BUY', pair: 'BTC/USD', price: 60000, amount: 0.1, timestamp: Date.now() - 2000000 },
    { side: 'SELL', pair: 'BTC/USD', price: 60800, amount: 0.1, timestamp: Date.now() - 1500000 },

    // 6. Win (Small): BTC Buy @ 61,000, Sell @ 61,100 (0.1 BTC) -> PnL: +10
    { side: 'BUY', pair: 'BTC/USD', price: 61000, amount: 0.1, timestamp: Date.now() - 1000000 },
    { side: 'SELL', pair: 'BTC/USD', price: 61100, amount: 0.1, timestamp: Date.now() - 500000 },
  ];

  it('should process a full session of 6 trades and generate a PnL report', async () => {
    // 1. Record trades
    for (const t of trades) {
      tracker.recordTrade(t as any);
    }

    // 2. Record some sentinel savings
    tracker.recordSavings(187.50);

    // 3. Get metrics
    const metrics = tracker.getMetrics();
    const summary = tracker.getSummary();

    // 4. Assertions
    expect(metrics.totalTrades).to.equal(12); // 6 buys + 6 sells
    expect(summary.trades.filter(t => t.realizedPnL !== undefined).length).to.equal(6);
    expect(metrics.winRate).to.be.closeTo(66.67, 0.1);
    expect(metrics.sentinelSavings).to.equal(187.50);
    expect(metrics.maxDrawdown).to.be.at.least(0);

    // 5. Print human-readable report
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║      VERTEX SENTINEL — SESSION REPORT    ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  Total Trades   : ${summary.trades.filter(t => t.realizedPnL !== undefined).length.toString().padEnd(23)}║`);
    console.log(`║  Realized PnL   : ${((metrics.realizedPnL >= 0 ? '+$' : '-$') + Math.abs(metrics.realizedPnL).toFixed(2)).padEnd(16)} ${metrics.realizedPnL >= 0 ? '✅ PROFIT' : '❌ LOSS'}  ║`);
    console.log(`║  Win Rate       : ${metrics.winRate.toFixed(2).toString().padEnd(23)}%║`);
    console.log(`║  Max Drawdown   : ${metrics.maxDrawdown.toFixed(2).toString().padEnd(23)}%║`);
    console.log(`║  Sharpe Ratio   : ${metrics.sharpeRatio.toFixed(2).toString().padEnd(23)}║`);
    console.log(`║  Sentinel Saved : $${metrics.sentinelSavings.toFixed(2).toString().padEnd(22)}║`);
    console.log('╚══════════════════════════════════════════╝\n');

    // 6. Save report
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

    fs.writeFileSync(
      path.join(logDir, 'pnl_report.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('Session report saved to logs/pnl_report.json');
  });
});
