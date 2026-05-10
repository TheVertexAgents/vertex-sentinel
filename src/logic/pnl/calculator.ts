export class PnLCalculator {
  /**
   * Calculates PnL for a trade including fees.
   */
  static calculateTradePnL(
    buyPrice: number,
    sellPrice: number,
    amount: number,
    feePercent: number
  ) {
    const buyValue = buyPrice * amount;
    const sellValue = sellPrice * amount;
    const grossPnL = sellValue - buyValue;

    const buyFee = buyValue * (feePercent / 100);
    const sellFee = sellValue * (feePercent / 100);
    const totalFees = buyFee + sellFee;

    const netPnL = grossPnL - totalFees;

    return {
      grossPnL,
      netPnL,
      fees: totalFees
    };
  }

  /**
   * Calculates ROI percentage.
   */
  static calculateROI(netPnL: number, invested: number): number {
    if (invested === 0) return 0;
    return (netPnL / invested) * 100;
  }

  /**
   * Calculates win rate from an array of trade PnL results.
   */
  static calculateWinRate(results: number[]): number {
    if (results.length === 0) return 0;
    const wins = results.filter(r => r > 0).length;
    return (wins / results.length) * 100;
  }

  /**
   * Calculates win/loss ratio.
   */
  static calculateWinLossRatio(results: number[]): number {
    const wins = results.filter(r => r > 0);
    const losses = results.filter(r => r < 0);
    if (losses.length === 0) return wins.length > 0 ? Infinity : 0;

    const avgWin = wins.reduce((a, b) => a + b, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length);

    return avgWin / avgLoss;
  }

  /**
   * Calculates Maximum Drawdown.
   * Hardened for Issue #146: Uses MDD_EQUITY_FLOOR to prevent mathematical skew from $0 baselines.
   */
  static calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length === 0) return 0;
    let maxDrawdown = 0;
    let peak = equityCurve[0];

    // Add MDD_EQUITY_FLOOR to prevent MDD > 100% when starting from low/zero equity.
    const floor = parseFloat(process.env.MDD_EQUITY_FLOOR || '100');

    for (const value of equityCurve) {
      if (value > peak) peak = value;
      // Use floor as minimum denominator to prevent skew from $0 baselines
      const denominator = Math.max(peak, floor);
      const currentDrawdown = (peak - value) / denominator;
      if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;
    }

    return maxDrawdown * 100;
  }

  /**
   * Calculates a simplified Sharpe Ratio.
   * Assuming risk-free rate is 0 for simplicity.
   */
  static calculateSharpeRatio(results: number[]): number {
    if (results.length < 2) return 0;
    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((a, b) => a + (b - mean) ** 2, 0) / (results.length - 1);
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : mean / stdDev;
  }
}
