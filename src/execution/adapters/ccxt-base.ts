import ccxt from 'ccxt';
import { logger } from '../../utils/logger.js';
import { SentinelError } from '../../utils/errors.js';

/**
 * @title CcxtBaseAdapter
 * @dev Abstract base wrapping ccxt unified API for multi-exchange support.
 */
export class CcxtBaseAdapter {
    protected exchange: ccxt.Exchange;

    constructor(exchangeId: string, apiKey: string, secret: string) {
        if (!ccxt.exchanges.includes(exchangeId)) {
            throw new SentinelError(`Unsupported exchange: ${exchangeId}`);
        }

        const exchangeClass = (ccxt as any)[exchangeId];
        this.exchange = new exchangeClass({
            apiKey: apiKey,
            secret: secret,
            enableRateLimit: true,
            options: {
                defaultType: 'spot'
            }
        });
    }

    public async getBalance(): Promise<any> {
        try {
            return await this.exchange.fetchBalance();
        } catch (error: any) {
            this.handleError('GET_BALANCE_FAILED', error);
        }
    }

    public async placeOrder(symbol: string, type: string, side: string, amount: number, price?: number, params: any = {}): Promise<any> {
        try {
            return await this.exchange.createOrder(symbol, type, side, amount, price, params);
        } catch (error: any) {
            this.handleError('PLACE_ORDER_FAILED', error);
        }
    }

    public async fetchOrderBook(symbol: string, limit: number = 20): Promise<any> {
        try {
            return await this.exchange.fetchOrderBook(symbol, limit);
        } catch (error: any) {
            this.handleError('FETCH_ORDER_BOOK_FAILED', error);
        }
    }

    public async fetchTicker(symbol: string): Promise<any> {
        try {
            return await this.exchange.fetchTicker(symbol);
        } catch (error: any) {
            this.handleError('FETCH_TICKER_FAILED', error);
        }
    }

    public async cancelOrder(id: string, symbol: string): Promise<any> {
        try {
            return await this.exchange.cancelOrder(id, symbol);
        } catch (error: any) {
            this.handleError('CANCEL_ORDER_FAILED', error);
        }
    }

    protected handleError(step: string, error: any) {
        logger.error({
            module: 'CCXT_ADAPTER',
            exchange: this.exchange.id,
            step,
            error: error.message
        });

        if (error instanceof ccxt.NetworkError) {
            throw new SentinelError(`Network error on ${this.exchange.id}: ${error.message}`, 'NETWORK_ERROR');
        } else if (error instanceof ccxt.ExchangeError) {
            throw new SentinelError(`Exchange error on ${this.exchange.id}: ${error.message}`, 'EXCHANGE_ERROR');
        } else {
            throw error;
        }
    }
}
