/**
 * @title KellyCriterion
 * @dev Calculates position sizing based on probability and win/loss ratio.
 */
export class KellyCriterion {
    /**
     * @dev Calculates the Kelly Fraction.
     * f* = p/a - q/b
     * where p is probability of win, q is probability of loss,
     * b is profit ratio (avg win / cost), a is loss ratio (usually 1).
     *
     * Simplified: f* = p - (1-p) / (avgWin / avgLoss)
     */
    public static calculate(winRate: number, avgWin: number, avgLoss: number): number {
        if (avgLoss === 0) return 1; // Avoid division by zero
        if (winRate <= 0) return 0;

        const b = avgWin / avgLoss;
        const p = winRate;
        const q = 1 - p;

        const f = p - (q / b);

        return Math.max(0, f); // Never return negative (no shorting via Kelly here)
    }

    /**
     * @dev Returns the fractional Kelly size to be more conservative.
     */
    public static getFractionalSize(winRate: number, avgWin: number, avgLoss: number, fraction: number = 0.25): number {
        const fullKelly = this.calculate(winRate, avgWin, avgLoss);
        return fullKelly * fraction;
    }
}
