import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { PnLTracker } from '../../../src/logic/pnl/tracker.js';

describe('PnLTracker', () => {
  let tracker: PnLTracker;

  beforeEach(() => {
    tracker = new PnLTracker();
  });

  it('should initialize with default configuration', () => {
    const metrics = tracker.getMetrics();
    expect(metrics.totalTrades).to.equal(0);
    expect(metrics.totalPnL).to.equal(0);
  });

  it('should accept custom configuration', () => {
    const customTracker = new PnLTracker({
      makerFeePercent: 0.1,
      takerFeePercent: 0.1,
      exchangeName: 'test-exchange'
    });
    expect(customTracker.getConfig().exchangeName).to.equal('test-exchange');
  });

  it('should record a single BUY trade and update position', () => {
    const trade = {
      id: '1',
      pair: 'BTC/USD',
      side: 'BUY' as const,
      price: 60000,
      amount: 0.1,
      timestamp: new Date().toISOString()
    };

    tracker.recordTrade(trade);
    const summary = tracker.getSummary();

    expect(summary.summary.totalTrades).to.equal(1);
    expect(summary.positions['BTC/USD']).to.not.be.undefined;
    expect(summary.positions['BTC/USD'].open).to.be.true;
    expect(summary.positions['BTC/USD'].amount).to.equal(0.1);
    expect(summary.positions['BTC/USD'].entryPrice).to.equal(60000);
  });

  it('should calculate realized PnL after closing a position', () => {
    const buyTrade = {
      id: '1',
      pair: 'BTC/USD',
      side: 'BUY' as const,
      price: 60000,
      amount: 0.1,
      timestamp: new Date().toISOString()
    };

    const sellTrade = {
      id: '2',
      pair: 'BTC/USD',
      side: 'SELL' as const,
      price: 66000,
      amount: 0.1,
      timestamp: new Date().toISOString()
    };

    tracker.recordTrade(buyTrade);
    tracker.recordTrade(sellTrade);

    const metrics = tracker.getMetrics();
    // (66000 - 60000) * 0.1 = 600
    // Fees (default 0.26% for taker/market):
    // Buy: 60000 * 0.1 * 0.0026 = 15.6
    // Sell: 66000 * 0.1 * 0.0026 = 17.16
    // Net: 600 - 15.6 - 17.16 = 567.24
    expect(metrics.realizedPnL).to.be.closeTo(567.24, 0.01);
    expect(metrics.totalTrades).to.equal(2);
    expect(tracker.getSummary().positions['BTC/USD'].open).to.be.false;
  });

  it('should track multiple positions (BTC and ETH) simultaneously', () => {
    tracker.recordTrade({
      id: '1',
      pair: 'BTC/USD',
      side: 'BUY',
      price: 60000,
      amount: 0.1,
      timestamp: new Date().toISOString()
    });

    tracker.recordTrade({
      id: '2',
      pair: 'ETH/USD',
      side: 'BUY',
      price: 3000,
      amount: 1,
      timestamp: new Date().toISOString()
    });

    const summary = tracker.getSummary();
    expect(summary.positions['BTC/USD'].open).to.be.true;
    expect(summary.positions['ETH/USD'].open).to.be.true;
    expect(summary.summary.totalTrades).to.equal(2);
  });

  it('should calculate unrealized PnL based on current market price', async () => {
    tracker.recordTrade({
      id: '1',
      pair: 'BTC/USD',
      side: 'BUY',
      price: 60000,
      amount: 0.1,
      timestamp: new Date().toISOString()
    });

    // Mocking mcpClient for price update
    const mockMcpClient = {
      callTool: sinon.stub().resolves({ content: [{ text: JSON.stringify({ c: ['65000', '0.1'] }) }] }) // Ticker result from Kraken MCP
    };

    await tracker.updateUnrealizedPnL('BTC/USD', mockMcpClient as any);

    const position = tracker.getSummary().positions['BTC/USD'];
    // (65000 - 60000) * 0.1 = 500
    // Buy fee: 60000 * 0.1 * 0.0026 = 15.6
    // Sell fee (projected): 65000 * 0.1 * 0.0026 = 16.9
    // Unrealized Net: 500 - 15.6 - 16.9 = 467.5
    expect(position.unrealizedPnL).to.be.closeTo(467.5, 0.01);
  });

  it('should calculate ROI percentage correctly', () => {
    tracker.recordTrade({
      id: '1',
      pair: 'BTC/USD',
      side: 'BUY',
      price: 60000,
      amount: 0.1,
      timestamp: new Date().toISOString()
    });

    tracker.recordTrade({
      id: '2',
      pair: 'BTC/USD',
      side: 'SELL',
      price: 66000,
      amount: 0.1,
      timestamp: new Date().toISOString()
    });

    const metrics = tracker.getMetrics();
    // Invested: 6000 + Fees (15.6) = 6015.6
    // Return: 567.24
    // ROI: (567.24 / 6015.6) * 100 = 9.429
    expect(metrics.roiPercent).to.be.closeTo(9.43, 0.01);
  });

  it('should calculate win rate correctly', () => {
    // Trade 1: Win
    tracker.recordTrade({ id: '1', pair: 'BTC/USD', side: 'BUY', price: 60000, amount: 0.1, timestamp: '' });
    tracker.recordTrade({ id: '2', pair: 'BTC/USD', side: 'SELL', price: 66000, amount: 0.1, timestamp: '' });

    // Trade 2: Loss
    tracker.recordTrade({ id: '3', pair: 'ETH/USD', side: 'BUY', price: 4000, amount: 1, timestamp: '' });
    tracker.recordTrade({ id: '4', pair: 'ETH/USD', side: 'SELL', price: 3000, amount: 1, timestamp: '' });

    const metrics = tracker.getMetrics();
    expect(metrics.winRate).to.equal(50);
  });
});
