import { agentEvents } from '../../utils/event-bus.js';
import { logger } from '../../utils/logger.js';

export interface OrderBookSnapshot {
    bids: [number, number][]; // [price, qty]
    asks: [number, number][];
    timestamp: number;
}

/**
 * @title OrderBookService
 * @dev Maintains real-time order book state and provides depth analysis.
 */
export class OrderBookService {
    private books: Map<string, OrderBookSnapshot> = new Map();

    public updateBook(symbol: string, snapshot: OrderBookSnapshot) {
        this.books.set(symbol, snapshot);
        agentEvents.emit('orderbook.update', { symbol, snapshot });
    }

    public getBestBid(symbol: string): number | null {
        const book = this.books.get(symbol);
        return book && book.bids.length > 0 ? book.bids[0][0] : null;
    }

    public getBestAsk(symbol: string): number | null {
        const book = this.books.get(symbol);
        return book && book.asks.length > 0 ? book.asks[0][0] : null;
    }

    public getMidPrice(symbol: string): number | null {
        const bid = this.getBestBid(symbol);
        const ask = this.getBestAsk(symbol);
        return bid && ask ? (bid + ask) / 2 : null;
    }

    public getSpread(symbol: string): number | null {
        const bid = this.getBestBid(symbol);
        const ask = this.getBestAsk(symbol);
        return bid && ask ? ask - bid : null;
    }

    public getMarketDepth(symbol: string, levels: number = 10): { bidDepth: number, askDepth: number } {
        const book = this.books.get(symbol);
        if (!book) return { bidDepth: 0, askDepth: 0 };

        const bidDepth = book.bids.slice(0, levels).reduce((acc, curr) => acc + curr[1], 0);
        const askDepth = book.asks.slice(0, levels).reduce((acc, curr) => acc + curr[1], 0);

        return { bidDepth, askDepth };
    }
}

export const orderBookService = new OrderBookService();
