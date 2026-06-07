import { expect } from 'chai';
import { orderManager } from '../../src/execution/order-manager.js';

describe('OrderManager & Advanced Order Types', () => {
    beforeEach(() => {
        process.env.BINANCE_API_KEY = 'test';
        process.env.BINANCE_SECRET = 'test';
    });

    it('should route OCO orders', async () => {
        const params = {
            symbol: 'BTCUSDT',
            quantity: 0.01,
            limitPrice: 70000,
            stopPrice: 68000,
            stopLimitPrice: 67900
        };
        const result = await orderManager.placeOCO(params);
        expect(result.status).to.equal('PENDING');
        expect(result.params.symbol).to.equal('BTCUSDT');
    });

    it('should route Stop-Limit orders', async () => {
        const params = {
            symbol: 'ETHUSDT',
            quantity: 1,
            stopPrice: 3500,
            limitPrice: 3490,
            side: 'SELL' as const
        };
        const result = await orderManager.placeStopLimit(params);
        expect(result.status).to.equal('ACCEPTED');
        expect(result.params.symbol).to.equal('ETHUSDT');
    });
});
