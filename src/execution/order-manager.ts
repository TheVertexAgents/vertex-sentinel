import { agentEvents } from '../utils/event-bus.js';
import { BinanceAdapter } from './adapters/binance.js';
import { KrakenAdapter } from './adapters/kraken.js';
import { ocoOrderService, OCOParams } from './order-types/oco.js';
import { stopLimitOrderService, StopLimitParams } from './order-types/stop-limit.js';
import { logger } from '../utils/logger.js';

/**
 * @title OrderManager
 * @dev Unified interface for all order types across exchanges.
 */
export class OrderManager {
    private binance: BinanceAdapter;
    private kraken: KrakenAdapter;

    constructor() {
        this.binance = new BinanceAdapter();
        this.kraken = new KrakenAdapter();
    }

    public getBinanceAdapter() {
        return this.binance;
    }

    public getKrakenAdapter() {
        return this.kraken;
    }

    private getAdapter(symbol: string) {
        // Simple routing logic: symbols with '/' are often CCXT/Kraken style,
        // while Binance uses concatenated strings.
        // For Vertex Sentinel, we'll default to Kraken for USD pairs and Binance for others,
        // or check environment configuration.
        if (process.env.DEFAULT_EXCHANGE === 'kraken' || symbol.includes('USD')) {
            return this.kraken;
        }
        return this.binance;
    }

    public async placeMarketOrder(symbol: string, side: 'BUY' | 'SELL', amount: number) {
        logger.info({ module: 'ORDER_MANAGER', step: 'PLACE_MARKET', symbol, side, amount });
        const adapter = this.getAdapter(symbol);
        const result = await adapter.placeOrder(symbol, 'market', side, amount);
        agentEvents.emit('order.filled', result);
        return result;
    }

    public async placeLimitOrder(symbol: string, side: 'BUY' | 'SELL', amount: number, price: number) {
        logger.info({ module: 'ORDER_MANAGER', step: 'PLACE_LIMIT', symbol, side, amount, price });
        const adapter = this.getAdapter(symbol);
        const result = await adapter.placeOrder(symbol, 'limit', side, amount, price);
        agentEvents.emit('order.placed', result);
        return result;
    }

    public async placeOCO(params: OCOParams) {
        const adapter = this.getAdapter(params.symbol);
        const result = await ocoOrderService.placeOCO(adapter, params);
        agentEvents.emit('order.oco.placed', result);
        return result;
    }

    public async placeStopLimit(params: StopLimitParams) {
        const adapter = this.getAdapter(params.symbol);
        const result = await stopLimitOrderService.placeStopLimit(adapter, params);
        agentEvents.emit('order.stoplimit.placed', result);
        return result;
    }
}

export const orderManager = new OrderManager();
