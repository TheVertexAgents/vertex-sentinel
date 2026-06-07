import ccxt from 'ccxt';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * @title MarketDataService
 * @dev Manages supported trading pairs and market metadata.
 */
export class MarketDataService {
    private cachePath = path.join(process.cwd(), 'data/market-pairs-cache.json');

    constructor() {
        const dir = path.dirname(this.cachePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    public async getSupportedPairs(exchangeId: string): Promise<string[]> {
        logger.info({ module: 'MARKET_DATA', step: 'FETCH_PAIRS', exchangeId });

        try {
            const exchangeClass = (ccxt as any)[exchangeId];
            const exchange = new exchangeClass();
            const markets = await exchange.loadMarkets();
            const pairs = Object.keys(markets);

            // Update cache
            this.updateCache(exchangeId, pairs);

            return pairs;
        } catch (error: any) {
            logger.warn({ module: 'MARKET_DATA', step: 'FETCH_PAIRS_FAILED', exchangeId, error: error.message });
            return this.getFromCache(exchangeId);
        }
    }

    private updateCache(exchangeId: string, pairs: string[]) {
        let cache: any = {};
        if (fs.existsSync(this.cachePath)) {
            cache = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        }
        cache[exchangeId] = pairs;
        fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2));
    }

    private getFromCache(exchangeId: string): string[] {
        if (fs.existsSync(this.cachePath)) {
            const cache = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
            return cache[exchangeId] || [];
        }
        return [];
    }
}

export const marketDataService = new MarketDataService();
