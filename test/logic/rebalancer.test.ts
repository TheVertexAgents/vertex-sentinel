import { expect } from 'chai';
import { PortfolioRebalancer, Holding, RebalanceTarget } from '../../src/logic/strategy/rebalancer.js';

describe('PortfolioRebalancer Unit Tests', () => {
    it('should calculate correct rebalancing orders', () => {
        const rebalancer = new PortfolioRebalancer();
        const totalValue = 10000;
        const holdings: Holding[] = [
            { symbol: 'BTC/USD', amount: 0.1, price: 60000 }, // 000 (60%)
            { symbol: 'ETH/USD', amount: 1.0, price: 3000 },  // 000 (30%)
            { symbol: 'SOL/USD', amount: 0, price: 100 }     // -bash
        ];
        const targets: RebalanceTarget[] = [
            { symbol: 'BTC/USD', targetWeightPct: 50 }, // Target 000 (Sell 000)
            { symbol: 'ETH/USD', targetWeightPct: 40 }, // Target 000 (Buy 000)
            { symbol: 'SOL/USD', targetWeightPct: 10 }  // Target 000 (Buy 000)
        ];

        const orders = rebalancer.calculateRebalancingOrders(holdings, targets, totalValue);

        expect(orders).to.have.lengthOf(3);
        expect(orders.find((o: any) => o.symbol === 'BTC/USD').side).to.equal('SELL');
        expect(orders.find((o: any) => o.symbol === 'ETH/USD').side).to.equal('BUY');
        expect(orders.find((o: any) => o.symbol === 'SOL/USD').side).to.equal('BUY');
    });

    it('should respect Kelly fraction as max order size', () => {
        const rebalancer = new PortfolioRebalancer();
        process.env.KELLY_FRACTION = '0.05'; // 5% max order (00)
        const totalValue = 10000;
        const holdings: Holding[] = [
            { symbol: 'BTC/USD', amount: 0.0333, price: 60000 } // 000 (20%)
        ];
        const targets: RebalanceTarget[] = [
            { symbol: 'BTC/USD', targetWeightPct: 40 }, // Diff 000 -> Cap at 00
        ];

        const orders = rebalancer.calculateRebalancingOrders(holdings, targets, totalValue);
        expect(orders).to.have.lengthOf(1);
        expect(orders[0].amount * 60000).to.be.closeTo(500, 1);
    });
});
