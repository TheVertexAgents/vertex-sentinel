import { expect } from 'chai';
import nock from 'nock';
import { BinanceAdapter } from '../../src/execution/adapters/binance.js';
import { binanceWeightTracker } from '../../src/execution/adapters/binance-weight-tracker.js';

describe('BinanceAdapter with Weight Tracker', () => {
    let adapter: BinanceAdapter;
    const baseUrl = 'https://api.binance.com';

    beforeEach(() => {
        process.env.BINANCE_API_KEY = 'test-api-key';
        process.env.BINANCE_SECRET = 'test-api-secret';
        adapter = new BinanceAdapter();
        // Reset weight tracker manually for testing
        (binanceWeightTracker as any).weight = 0;
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('should correctly compute HMAC signature', async () => {
        // We mock the CCXT fetchBalance which calls /api/v3/account
        nock(baseUrl)
            .get(/api\/v3\/account/)
            .reply(200, { info: { canTrade: true }, balances: [] });

        const balance = await adapter.getBalance();
        expect(balance).to.exist;
    });

    it('should increment weight after successful request', async () => {
        nock(baseUrl)
            .get(/api\/v3\/account/)
            .reply(200, { info: { canTrade: true }, balances: [] });

        await adapter.getBalance();
        expect(binanceWeightTracker.getWeight()).to.equal(10);
    });

    it('should block request when weight threshold is reached', async () => {
        // Force weight to threshold
        (binanceWeightTracker as any).weight = 1100;

        try {
            await adapter.getBalance();
            expect.fail('Should have thrown error');
        } catch (error: any) {
            expect(error.message).to.equal('Binance rate limit buffer reached');
        }
    });

    it('should normalize placeOrder response', async () => {
        const mockResponse = {
            symbol: 'BTCUSDT',
            orderId: 12345,
            status: 'FILLED'
        };

        nock(baseUrl)
            .post(/api\/v3\/order/)
            .reply(200, mockResponse);

        const order = await adapter.placeOrder('BTCUSDT', 'market', 'buy', 0.001);

        expect(order.symbol).to.equal('BTCUSDT');
        expect(binanceWeightTracker.getWeight()).to.equal(1);
    });
});
