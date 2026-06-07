import { CcxtBaseAdapter } from './ccxt-base.js';

/**
 * @title KrakenAdapter
 * @dev Exchange adapter for Kraken integration, extending CcxtBaseAdapter.
 */
export class KrakenAdapter extends CcxtBaseAdapter {
    constructor() {
        const apiKey = process.env.KRAKEN_API_KEY || '';
        const secret = process.env.KRAKEN_SECRET || '';
        super('kraken', apiKey, secret);
    }
}
