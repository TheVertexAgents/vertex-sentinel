import ccxt, { Exchange } from 'ccxt';
import { logger } from '../../utils/logger.js';
import { SentinelError } from '../../utils/errors.js';

/**
 * @title CcxtBaseAdapter
 * @dev Abstract base wrapping ccxt unified API for multi-exchange support.
 */
export class CcxtBaseAdapter {
    protected exchange: Exchange;

    constructor(exchangeId: string, apiKey: string, secret: string) {
        if (!ccxt.exchanges.includes(exchangeId)) {
            throw new SentinelError(`Unsupported exchange: ${exchangeId}`);
        }

        const exchangeClass = (ccxt as any)[exchangeId];
        this.exchange = new exchangeClass({
            apiKey: apiKey,
            secret: secret,
            enableRateLimit: true
        });
    }

    private handleError(error: any, method: string): never {
        const msg = `CCXT Error [${method}]: ${error.message}`;
        logger.error({ module: 'CCXT_ADAPTER', step: method, error: error.message });
        if (error instanceof ccxt.NetworkError) {
            throw new SentinelError(`Network Error: ${msg}`, 'NETWORK_ERROR');
        }
        throw new SentinelError(msg, 'EXCHANGE_ERROR');
    }

    public async getBalance(): Promise<any> {
        try {
            return await this.exchange.fetchBalance();
        } catch (e) {
            this.handleError(e, 'fetchBalance');
        }
    }

    public async placeOrder(symbol: string, type: 'market' | 'limit', side: 'buy' | 'sell', amount: number, price?: number): Promise<any> {
        try {
            return await this.exchange.createOrder(symbol, type, side, amount, price);
        } catch (e) {
            this.handleError(e, 'createOrder');
        }
    }

    public async fetchOrderBook(symbol: string): Promise<any> {
        try {
            return await this.exchange.fetchOrderBook(symbol);
        } catch (e) {
            this.handleError(e, 'fetchOrderBook');
        }
    }

    public async fetchTicker(symbol: string): Promise<any> {
        try {
            return await this.exchange.fetchTicker(symbol);
        } catch (e) {
            this.handleError(e, 'fetchTicker');
        }
    }
}
