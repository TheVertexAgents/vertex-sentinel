import { agentEvents } from '../utils/event-bus.js';
import { BinanceAdapter } from './adapters/binance.js';
import { ocoOrderService, OCOParams } from './order-types/oco.js';
import { stopLimitOrderService, StopLimitParams } from './order-types/stop-limit.js';
import { logger } from '../utils/logger.js';

/**
 * @title OrderManager
 * @dev Unified interface for all order types across exchanges.
 */
export class OrderManager {
    private binance: BinanceAdapter;

    constructor() {
        this.binance = new BinanceAdapter();
    }

    public async placeMarketOrder(symbol: string, side: 'BUY' | 'SELL', amount: number) {
        logger.info({ module: 'ORDER_MANAGER', step: 'PLACE_MARKET', symbol, side, amount });
        const result = await this.binance.placeOrder(symbol, 'market', side, amount);
        agentEvents.emit('order.filled', result);
        return result;
    }

    public async placeLimitOrder(symbol: string, side: 'BUY' | 'SELL', amount: number, price: number) {
        logger.info({ module: 'ORDER_MANAGER', step: 'PLACE_LIMIT', symbol, side, amount, price });
        const result = await this.binance.placeOrder(symbol, 'limit', side, amount, price);
        agentEvents.emit('order.placed', result);
        return result;
    }

    public async placeOCO(params: OCOParams) {
        const result = await ocoOrderService.placeOCO(params);
        agentEvents.emit('order.oco.placed', result);
        return result;
    }

    public async placeStopLimit(params: StopLimitParams) {
        const result = await stopLimitOrderService.placeStopLimit(params);
        agentEvents.emit('order.stoplimit.placed', result);
        return result;
    }
}

export const orderManager = new OrderManager();
