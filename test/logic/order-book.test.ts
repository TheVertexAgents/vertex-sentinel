import { expect } from 'chai';
import { orderBookService } from '../../src/logic/strategy/order-book.js';

describe('OrderBookService', () => {
    const symbol = 'BTC/USDC';

    beforeEach(() => {
        orderBookService.updateBook(symbol, {
            bids: [[60000, 1.5], [59900, 2.0]],
            asks: [[60100, 1.0], [60200, 3.0]],
            timestamp: Date.now()
        });
    });

    it('should return best bid and ask', () => {
        expect(orderBookService.getBestBid(symbol)).to.equal(60000);
        expect(orderBookService.getBestAsk(symbol)).to.equal(60100);
    });

    it('should calculate mid price and spread', () => {
        expect(orderBookService.getMidPrice(symbol)).to.equal(60050);
        expect(orderBookService.getSpread(symbol)).to.equal(100);
    });

    it('should calculate market depth', () => {
        const depth = orderBookService.getMarketDepth(symbol, 2);
        expect(depth.bidDepth).to.equal(3.5);
        expect(depth.askDepth).to.equal(4.0);
    });
});
