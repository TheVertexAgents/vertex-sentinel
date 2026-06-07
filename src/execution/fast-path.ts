import { logger } from '../utils/logger.js';

/**
 * @title FastPathExecution
 * @dev Optimizes execution latency by caching EIP-712 templates and managing nonces.
 */
export class FastPathExecution {
    private templateCache: Map<string, any> = new Map();
    private noncePool: number[] = [];

    public getTemplate(params: any) {
        const key = JSON.stringify(params);
        if (this.templateCache.has(key)) {
            logger.debug({ module: 'FAST_PATH', step: 'TEMPLATE_CACHE_HIT' });
            return this.templateCache.get(key);
        }

        // Complex object construction here
        const template = { ...params, version: '1.0' };
        this.templateCache.set(key, template);
        return template;
    }

    public async executeParallel(riskTask: Promise<any>, signTask: Promise<any>) {
        const start = Date.now();
        const [risk, signature] = await Promise.all([riskTask, signTask]);
        const latency = Date.now() - start;

        logger.info({ module: 'FAST_PATH', step: 'PARALLEL_EXECUTION', latencyMs: latency });
        return { risk, signature, latencyMs: latency };
    }

    public fillNoncePool(startNonce: number) {
        this.noncePool = [startNonce, startNonce + 1, startNonce + 2];
    }

    public getNextNonce() {
        return this.noncePool.shift();
    }
}

export const fastPath = new FastPathExecution();
