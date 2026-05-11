import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { groq, llama33x70bVersatile } from 'genkitx-groq';
import { logger } from './logger.js';
import { QuotaTracker } from './quota-tracker.js';

const plugins = [];
if (process.env.GOOGLE_GENAI_API_KEY) {
  plugins.push(googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY }));
}
if (process.env.GROQ_API_KEY) {
  plugins.push(groq({ apiKey: process.env.GROQ_API_KEY }));
}

export const ai = genkit({ plugins });

/**
 * @dev Global Rate Limiter for AI requests.
 * Enforces a hard cap on requests per minute (RPM).
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRPM: number = 10;

  async wait(): Promise<void> {
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

/**
 * @dev Circuit Breaker for AI requests.
 * Prevents cascading failures when the AI provider is down.
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = process.env.AI_PROVIDER === 'groq' ? 10 : 5;
  private readonly cooldown = process.env.AI_PROVIDER === 'groq' ? 120_000 : 300_000;

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
  }

  recordSuccess() {
    this.failures = 0;
  }

  isOpen(): boolean {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailureTime > this.cooldown) {
        // Half-open state: allow one trial request
        return false;
      }
      return true;
    }
    return false;
  }
}

const circuitBreaker = new CircuitBreaker();

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
  const quota = QuotaTracker.getInstance();
  if (!quota.canRequest()) {
    logger.error({ module, step: 'QUOTA_EXHAUSTED', message: 'Daily AI quota limit reached.' });
    return null;
  }

  if (circuitBreaker.isOpen()) {
    logger.warn({ module, step: 'CIRCUIT_BREAKER_OPEN', message: 'AI circuit breaker is open. Skipping request.' });
    return null;
  }

  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await limiter.wait();

      // Resolve AI Provider and Model
      const provider = process.env.AI_PROVIDER || 'google';
      let modelName = process.env.AI_MODEL;

      let model;
      if (provider === 'groq') {
        if (!modelName || modelName === 'gemini-flash-latest' || modelName === 'llama-3.3-70b-versatile') {
          model = llama33x70bVersatile;
        } else {
          model = `groq/${modelName}`;
        }
      } else {
        modelName = modelName || 'gemini-flash-latest';
        model = googleAI.model(modelName);
      }

      const finalParams = {
        ...params,
        model
      };

      const response = await ai.generate(finalParams);
      await quota.increment();
      circuitBreaker.recordSuccess();
      return response.output;
    } catch (err: any) {
      circuitBreaker.recordFailure();
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
