import crypto from 'crypto';
import { CcxtBaseAdapter } from './ccxt-base.js';
import { binanceWeightTracker } from './binance-weight-tracker.js';

/**
 * @title BinanceAdapter
 * @dev Exchange adapter for Binance integration, extending CcxtBaseAdapter.
 */
export class BinanceAdapter extends CcxtBaseAdapter {
    private apiSecret: string;

    constructor() {
        const apiKey = process.env.BINANCE_API_KEY || '';
        const secret = process.env.BINANCE_SECRET || '';
        super('binance', apiKey, secret);
        this.apiSecret = secret;
    }

    private sign(queryString: string): string {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * @dev Override getBalance to include weight tracking.
     */
    public async getBalance(): Promise<any> {
        if (!binanceWeightTracker.checkWeight(10)) {
            throw new Error('Binance rate limit buffer reached');
        }
        const balance = await super.getBalance();
        binanceWeightTracker.increment(10);
        return balance;
    }

    /**
     * @dev Override placeOrder to include weight tracking.
     */
    public async placeOrder(symbol: string, type: string, side: string, amount: number, price?: number, params: any = {}): Promise<any> {
        if (!binanceWeightTracker.checkWeight(1)) {
            throw new Error('Binance rate limit buffer reached');
        }
        const order = await super.placeOrder(symbol, type, side, amount, price, params);
        binanceWeightTracker.increment(1);
        return order;
    }

    /**
     * @dev Keep direct API access if needed via HMAC.
     */
    public async getDirectAccountInfo(): Promise<any> {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = this.sign(queryString);

        // This is a placeholder for direct calls if CCXT is insufficient
        return { signature, timestamp };
    }
}
