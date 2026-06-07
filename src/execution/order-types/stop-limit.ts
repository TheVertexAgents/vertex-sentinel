import { logger } from '../../utils/logger.js';
import { CcxtBaseAdapter } from '../adapters/ccxt-base.js';

export interface StopLimitParams {
    symbol: string;
    quantity: number;
    stopPrice: number;
    limitPrice: number;
    side: 'BUY' | 'SELL';
}

/**
 * @title StopLimitOrderService
 * @dev Manages Stop-Limit orders.
 */
export class StopLimitOrderService {
    public async placeStopLimit(adapter: CcxtBaseAdapter, params: StopLimitParams): Promise<any> {
        logger.info({ module: 'STOP_LIMIT', step: 'PLACE_ORDER', params });

        // CCXT standard for stop-limit orders often involves passing stopPrice in params
        return await adapter.placeOrder(
            params.symbol,
            'limit',
            params.side.toLowerCase(),
            params.quantity,
            params.limitPrice,
            {
                stopPrice: params.stopPrice,
                type: 'stopLimit' // Some exchanges require explicit type in params
            }
        );
    }
}

export const stopLimitOrderService = new StopLimitOrderService();
