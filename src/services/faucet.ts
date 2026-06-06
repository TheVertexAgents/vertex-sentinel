import { logger } from '../utils/logger.js';

/**
 * @title FaucetService
 * @dev Handles testnet fund requests with retry logic and rate limiting.
 */
export class FaucetService {
    private static instance: FaucetService;
    private lastRequestTime = new Map<string, number>();

    private constructor() {}

    public static getInstance(): FaucetService {
        if (!FaucetService.instance) {
            FaucetService.instance = new FaucetService();
        }
        return FaucetService.instance;
    }

    /**
     * @dev Requests testnet funds for a given address.
     * Includes exponential backoff retry logic.
     */
    public async requestTestnetFunds(address: string): Promise<string> {
        // Rate limit: 1 request per hour per IP (handled at controller level)
        // Here we just enforce a per-address basic check
        const now = Date.now();
        const lastTime = this.lastRequestTime.get(address) || 0;
        if (now - lastTime < 60 * 60 * 1000) {
            throw new Error('Rate limit exceeded for this address. Try again in 1 hour.');
        }

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                logger.info({ module: 'FAUCET', step: 'REQUESTING_FUNDS', address, attempt: attempts });

                // Placeholder for actual Faucet API call
                // Example: const res = await axios.post('https://faucet.alchemy.com/api/request', { address });
                const txHash = `0x${Math.random().toString(16).substring(2, 66).padEnd(64, '0')}`;

                // Simulate network latency
                await new Promise(resolve => setTimeout(resolve, 500));

                this.lastRequestTime.set(address, now);
                return txHash;

            } catch (error) {
                if (attempts >= maxAttempts) throw error;
                const delay = Math.pow(2, attempts) * 1000;
                logger.warn({ module: 'FAUCET', step: 'RETRYING', address, delay });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error('Failed to request funds after 3 attempts');
    }
}
