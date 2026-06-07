import { expect } from 'chai';
import { portfolioRebalancer } from '../../src/logic/strategy/rebalancer.js';

describe('PortfolioRebalancer', () => {
    const totalValue = 10000;
    const holdings = [
        { symbol: 'BTC/USD', amount: 0.1, price: 60000 }, // $6000 (60%)
        { symbol: 'ETH/USD', amount: 1, price: 3000 },    // $3000 (30%)
    ];

    it('should calculate rebalancing orders to reach targets', () => {
        const targets = [
            { symbol: 'BTC/USD', targetWeightPct: 50 }, // Target $5000 (Sell $1000)
            { symbol: 'ETH/USD', targetWeightPct: 40 }, // Target $4000 (Buy $1000)
            { symbol: 'SOL/USD', targetWeightPct: 10 }  // Target $1000 (Buy $1000)
        ];

        const orders = portfolioRebalancer.calculateRebalancingOrders(holdings, targets, totalValue);

        expect(orders).to.have.lengthOf(3);
        expect(orders.find(o => o.symbol === 'BTC/USD').action).to.equal('SELL');
        expect(orders.find(o => o.symbol === 'ETH/USD').action).to.equal('BUY');
        expect(orders.find(o => o.symbol === 'SOL/USD').action).to.equal('BUY');
    });

    it('should respect Kelly fraction as max order size', () => {
        process.env.KELLY_FRACTION = '0.05'; // 5% max order ($500)
        const targets = [
            { symbol: 'BTC/USD', targetWeightPct: 40 }, // Diff $2000 -> Cap at $500
        ];

        const orders = portfolioRebalancer.calculateRebalancingOrders(holdings, targets, totalValue);
        expect(orders[0].amountUsd).to.equal(500);
    });
});
