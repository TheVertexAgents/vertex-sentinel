export interface FeeRate {
    maker: number;
    taker: number;
    tier: string;
}

/**
 * @title FeeOptimizer
 * @dev Calculates optimal fees based on market urgency and liquidity.
 */
export class FeeOptimizer {
    public getOptimalFeeRate(_symbol: string, urgency: 'HIGH' | 'LOW'): FeeRate {
        if (urgency === 'HIGH') {
            return { maker: 0.001, taker: 0.002, tier: 'URGENT' };
        }

        return { maker: 0.0005, taker: 0.001, tier: 'STANDARD' };
    }
}

export const feeOptimizer = new FeeOptimizer();
