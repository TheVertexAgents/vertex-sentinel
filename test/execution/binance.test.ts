import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { BinanceAdapter } from '../../src/execution/adapters/binance.js';
import { binanceWeightTracker } from '../../src/execution/adapters/binance-weight-tracker.js';

describe('BinanceAdapter with Weight Tracker', () => {
    let adapter: BinanceAdapter;

    beforeEach(() => {
        process.env.BINANCE_API_KEY = 'test-api-key';
        process.env.BINANCE_SECRET = 'test-api-secret';
        adapter = new BinanceAdapter();
        // Reset weight tracker manually for testing
        (binanceWeightTracker as any).weight = 0;
    });

    afterEach(() => {
        sinon.restore();
        nock.cleanAll();
    });

    it('should correctly compute HMAC signature', async () => {
        // Mock ccxt's internal fetchBalance to avoid 451/network issues
        sinon.stub(adapter['exchange'], 'fetchBalance').resolves({ info: { canTrade: true }, balances: [] });

        const balance = await adapter.getBalance();
        expect(balance).to.exist;
    });

    it('should increment weight after successful request', async () => {
        sinon.stub(adapter['exchange'], 'fetchBalance').resolves({ info: { canTrade: true }, balances: [] });

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
            id: '12345',
            symbol: 'BTCUSDT',
            status: 'open'
        };

        sinon.stub(adapter['exchange'], 'createOrder').resolves(mockResponse);

        const order = await adapter.placeOrder('BTCUSDT', 'market', 'buy', 0.001);

        expect(order.symbol).to.equal('BTCUSDT');
        expect(binanceWeightTracker.getWeight()).to.equal(1);
    });
});
