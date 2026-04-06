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
});
