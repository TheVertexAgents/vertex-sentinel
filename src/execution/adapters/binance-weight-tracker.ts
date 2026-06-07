import { logger } from '../../utils/logger.js';
import { agentEvents } from '../../utils/event-bus.js';

/**
 * @title BinanceWeightTracker
 * @dev Manages Binance API request weights to avoid rate limiting.
 */
export class BinanceWeightTracker {
    private weight: number = 0;
    private readonly MAX_WEIGHT = 1200;
    private readonly BUFFER_THRESHOLD = 1100;
    private windowStart: number = Date.now();

    constructor() {
        // Reset weight every 60 seconds
        setInterval(() => {
            this.weight = 0;
            this.windowStart = Date.now();
        }, 60000);
    }

    public getWeight(): number {
        return this.weight;
    }

    public checkWeight(requestWeight: number = 1): boolean {
        if (this.weight + requestWeight >= this.BUFFER_THRESHOLD) {
            const msg = `Binance weight threshold reached: ${this.weight + requestWeight}/${this.MAX_WEIGHT}`;
            logger.warn({ module: 'WEIGHT_TRACKER', step: 'THRESHOLD_REACHED', weight: this.weight + requestWeight });

            agentEvents.emit('risk.alert', {
                type: 'RATE_LIMIT_WARNING',
                severity: 'HIGH',
                message: msg,
                currentWeight: this.weight + requestWeight
            });

            return false;
        }
        return true;
    }

    public increment(requestWeight: number = 1): void {
        this.weight += requestWeight;
    }
}

export const binanceWeightTracker = new BinanceWeightTracker();
