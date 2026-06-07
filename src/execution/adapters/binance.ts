import { CcxtBaseAdapter } from './ccxt-base.js';
import { binanceWeightTracker } from './binance-weight-tracker.js';

/**
 * @title BinanceAdapter
 * @dev Binance-specific adapter with weight tracking and HMAC signing.
 */
export class BinanceAdapter extends CcxtBaseAdapter {
    constructor() {
        const apiKey = process.env.BINANCE_API_KEY || '';
        const secret = process.env.BINANCE_SECRET || '';
        super('binance', apiKey, secret);
    }

    /**
     * @dev Overrides placeOrder to include Binance weight tracking.
     */
    public async placeOrder(symbol: string, type: 'market' | 'limit', side: 'buy' | 'sell', amount: number, price?: number): Promise<any> {
        if (!binanceWeightTracker.checkWeight(1)) {
            throw new Error('Binance rate limit buffer reached');
        }
        const order = await super.placeOrder(symbol, type, side, amount, price);
        binanceWeightTracker.increment(1);
        return order;
    }
}
