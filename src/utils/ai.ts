import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { logger } from './logger.js';

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })],
});

/**
 * @dev Global Rate Limiter for AI requests.
 * Enforces a hard cap on requests per minute (RPM).
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRPM: number = 10;

  async wait() {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < 60000);

    if (this.requests.length >= this.maxRPM) {
      const waitTime = 60000 - (now - this.requests[0]);
      logger.warn({ module: 'RateLimiter', step: 'WAIT', waitTimeMs: waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.wait();
    }

    this.requests.push(Date.now());
  }
}

const limiter = new RateLimiter();

const aiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300_000; // 5 minutes

export function getCachedAI(key: string) {
  const cached = aiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export function setCachedAI(key: string, data: any) {
  aiCache.set(key, { data, timestamp: Date.now() });
}

export async function generateWithRetry(module: string, params: any, maxAttempts = 3) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await limiter.wait();
      const response = await ai.generate(params);
      return response.output;
    } catch (err: any) {
      attempts++;
      const isQuotaError = err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429');
      const isRetryableError = isQuotaError || err.message?.includes('503');

      if (isRetryableError) {
        // More conservative backoff for quota errors
        const baseDelay = isQuotaError ? 5000 : 2000;
        const delay = Math.pow(2, attempts) * baseDelay;

        logger.warn({ module, step: 'RETRY', attempt: attempts, delay, error: err.message });
        await new Promise(r => setTimeout(r, delay));
      } else {
        logger.error({ module, step: 'API_FAILED', error: err.message });
        throw err;
      }
    }
  }
  return null;
}
