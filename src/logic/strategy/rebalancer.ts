import { logger } from '../../utils/logger.js';

export interface RebalanceTarget {
    symbol: string;
    targetWeightPct: number;
}

export interface Holding {
    symbol: string;
    amount: number;
    price: number;
}

/**
 * @title PortfolioRebalancer
 * @dev Calculates necessary orders to reach target portfolio weights.
 */
export class PortfolioRebalancer {
    /**
     * @dev Calculates rebalancing orders respecting Kelly Criterion.
     */
    public calculateRebalancingOrders(holdings: Holding[], targets: RebalanceTarget[], totalValueUsd: number): any[] {
        logger.info({ module: 'REBALANCER', step: 'CALCULATE', holdings, targets, totalValueUsd });

        const orders: any[] = [];
        const kellyFraction = parseFloat(process.env.KELLY_FRACTION || '0.25');

        targets.forEach(target => {
            const currentHolding = holdings.find(h => h.symbol === target.symbol) || { symbol: target.symbol, amount: 0, price: 0 };
            const targetValue = totalValueUsd * (target.targetWeightPct / 100);
            const currentValue = currentHolding.amount * currentHolding.price;

            let diffUsd = targetValue - currentValue;

            // Apply Kelly as a max per-order limit (simulated)
            const maxOrderSize = totalValueUsd * kellyFraction;
            if (Math.abs(diffUsd) > maxOrderSize) {
                logger.warn({ module: 'REBALANCER', step: 'KELLY_CAP', symbol: target.symbol, original: diffUsd, capped: maxOrderSize });
                diffUsd = diffUsd > 0 ? maxOrderSize : -maxOrderSize;
            }

            if (Math.abs(diffUsd) > 10) { // 0 minimum rebalance
                orders.push({
                    symbol: target.symbol,
                    side: diffUsd > 0 ? 'BUY' : 'SELL',
                    amount: Math.abs(diffUsd) / currentHolding.price
                });
            }
        });

        return orders;
    }
}
