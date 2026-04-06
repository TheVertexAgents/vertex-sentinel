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
}
