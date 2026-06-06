import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../../utils/logger.js';

/**
 * @title BinanceAdapter
 * @dev Exchange adapter for Binance integration.
 */
export class BinanceAdapter {
    private apiKey: string;
    private apiSecret: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.BINANCE_API_KEY || '';
        this.apiSecret = process.env.BINANCE_SECRET || '';
        this.baseUrl = process.env.BINANCE_BASE_URL || 'https://api.binance.com';
    }

    private sign(queryString: string): string {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    public async getBalance(): Promise<any> {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = this.sign(queryString);

        try {
            const res = await axios.get(`${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': this.apiKey }
            });
            return res.data;
        } catch (error: any) {
            logger.error({ module: 'BINANCE_ADAPTER', step: 'GET_BALANCE_FAILED', error: error.message });
            throw error;
        }
    }

    public async placeOrder(params: { symbol: string, side: 'BUY' | 'SELL', type: string, quantity: number, price?: number }): Promise<any> {
        const timestamp = Date.now();
        let queryString = `symbol=${params.symbol}&side=${params.side}&type=${params.type}&quantity=${params.quantity}&timestamp=${timestamp}`;
        if (params.price) queryString += `&price=${params.price}&timeInForce=GTC`;

        const signature = this.sign(queryString);

        try {
            const res = await axios.post(`${this.baseUrl}/api/v3/order?${queryString}&signature=${signature}`, null, {
                headers: { 'X-MBX-APIKEY': this.apiKey }
            });
            return res.data;
        } catch (error: any) {
            logger.error({ module: 'BINANCE_ADAPTER', step: 'PLACE_ORDER_FAILED', error: error.message });
            throw error;
        }
    }

    public async getOrderStatus(symbol: string, orderId: string): Promise<any> {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = this.sign(queryString);

        try {
            const res = await axios.get(`${this.baseUrl}/api/v3/order?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': this.apiKey }
            });
            return res.data;
        } catch (error: any) {
            logger.error({ module: 'BINANCE_ADAPTER', step: 'GET_ORDER_STATUS_FAILED', error: error.message });
            throw error;
        }
    }

    public async cancelOrder(symbol: string, orderId: string): Promise<any> {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = this.sign(queryString);

        try {
            const res = await axios.delete(`${this.baseUrl}/api/v3/order?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': this.apiKey }
            });
            return res.data;
        } catch (error: any) {
            logger.error({ module: 'BINANCE_ADAPTER', step: 'CANCEL_ORDER_FAILED', error: error.message });
            throw error;
        }
    }
}
