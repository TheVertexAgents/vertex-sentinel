import { describe, it } from 'mocha';
import { expect } from 'chai';
import { PnLCalculator } from '../../../src/logic/pnl/calculator.js';

describe('PnLCalculator', () => {
  it('should calculate trade PnL with fees', () => {
    const buyPrice = 60000;
    const sellPrice = 66000;
    const amount = 0.1;
    const feePercent = 0.26;

    const result = PnLCalculator.calculateTradePnL(buyPrice, sellPrice, amount, feePercent);

    // Gross: (66000 - 60000) * 0.1 = 600
    // Buy Fee: 6000 * 0.0026 = 15.6
    // Sell Fee: 6600 * 0.0026 = 17.16
    // Total Fees: 32.76
    // Net: 600 - 32.76 = 567.24
    expect(result.netPnL).to.be.closeTo(567.24, 0.01);
    expect(result.grossPnL).to.equal(600);
    expect(result.fees).to.be.closeTo(32.76, 0.01);
  });

  it('should calculate ROI percentage', () => {
    const netPnL = 567.24;
    const invested = 6015.6; // Price * Amount + Buy Fee
    const roi = PnLCalculator.calculateROI(netPnL, invested);
    expect(roi).to.be.closeTo(9.43, 0.01);
  });

  it('should handle zero investment for ROI', () => {
    expect(PnLCalculator.calculateROI(100, 0)).to.equal(0);
  });

  it('should calculate win rate from trade results', () => {
    const results = [100, -50, 200, -100, 50]; // 3 wins, 2 losses
    const winRate = PnLCalculator.calculateWinRate(results);
    expect(winRate).to.equal(60);
  });

  it('should return zero win rate for no trades', () => {
    expect(PnLCalculator.calculateWinRate([])).to.equal(0);
  });

  it('should calculate win/loss ratio correctly', () => {
    const results = [100, -50, 200, -100, 300];
    // Avg Win: (100 + 200 + 300) / 3 = 200
    // Avg Loss: (50 + 100) / 2 = 75
    // Ratio: 200 / 75 = 2.666...
    expect(PnLCalculator.calculateWinLossRatio(results)).to.be.closeTo(2.67, 0.01);
  });

  it('should calculate max drawdown correctly with MDD_EQUITY_FLOOR', () => {
    // With floor = 100, curve [0, 100, 80, 120, 90, 150]
    // Initial peak = max(0, 100) = 100
    // Peak 100 -> 80 (20% drawdown)
    // Peak 120 -> 90 (25% drawdown)
    // Max DD: 25%
    process.env.MDD_EQUITY_FLOOR = '100';
    const curve = [0, 100, 80, 120, 90, 150];
    expect(PnLCalculator.calculateMaxDrawdown(curve)).to.equal(25);
  });

  it('should normalize MDD using floor when peak is low', () => {
    process.env.MDD_EQUITY_FLOOR = '100';
    // Starting with 0, drop to -20.
    // Peak = 0. Value = -20. Denominator = max(0, 100) = 100.
    // DD = (0 - (-20)) / 100 = 20%.
    const curve = [0, -20];
    expect(PnLCalculator.calculateMaxDrawdown(curve)).to.equal(20);
  });

  it('should calculate sharpe ratio correctly', () => {
    const results = [10, 20, 10, 20];
    // Mean: 15
    // StdDev: 5.77...
    // Sharpe: 15 / 5.77 = 2.598...
    expect(PnLCalculator.calculateSharpeRatio(results)).to.be.closeTo(2.6, 0.1);
  });
});
