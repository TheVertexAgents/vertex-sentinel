import { logger } from '../../utils/logger.js';
import { orderBookService } from '../strategy/order-book.js';

export interface FeeRate {
    maker: number;
    taker: number;
    tier: string;
}

/**
 * @title FeeOptimizer
 * @dev Recommends optimal fee tiers based on urgency and market spread.
 */
export class FeeOptimizer {
    public getOptimalFeeRate(exchange: string, symbol: string, urgency: 'low' | 'medium' | 'high'): FeeRate {
        const spread = orderBookService.getSpread(symbol) || 0;
        const midPrice = orderBookService.getMidPrice(symbol) || 1;
        const spreadBps = (spread / midPrice) * 10000;

        let tier = 'STANDARD';
        let maker = 0.001; // 10 bps
        let taker = 0.002; // 20 bps

        if (urgency === 'low' && spreadBps > 10) {
            tier = 'MAKER_OPTIMIZED';
            taker = 0.0015; // Prefer limit orders
        } else if (urgency === 'high') {
            tier = 'URGENT_TAKER';
            taker = 0.0025; // Pay for immediate fill
        }

        logger.info({ module: 'FEE_OPTIMIZER', exchange, symbol, tier, urgency });
        return { maker, taker, tier };
    }
}

export const feeOptimizer = new FeeOptimizer();
