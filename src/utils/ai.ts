import dotenv from 'dotenv';
dotenv.config();
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

export function resetAIGlobals() {
  (limiter as any).requests = [];
  (circuitBreaker as any).failures = 0;
  QuotaTracker.getInstance().resetForTest();
}

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

export async function generateWithRetry(module: string, params: any, maxAttempts = 3, options?: { provider?: string; modelName?: string }) {
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

      // Resolve AI Provider and Model (allow override via options)
      const provider = (options?.provider || process.env.AI_PROVIDER || 'google').trim().toLowerCase();
      let modelName = (options?.modelName || process.env.AI_MODEL || '').trim();

      let model;
      if (provider === 'groq') {
        // Force default model if name matches known identifiers or is empty
        if (!modelName || modelName === 'gemini-flash-latest' || modelName.includes('llama-3.3-70b-versatile')) {
          model = llama33x70bVersatile;
          modelName = 'llama-3.3-70b-versatile';
        } else {
          model = `groq/${modelName}`;
        }
      } else {
        modelName = modelName || 'gemini-flash-latest';
        model = googleAI.model(modelName);
      }

      logger.info({ 
        module, 
        step: 'MODEL_RESOLUTION', 
        provider, 
        modelName, 
        resolvedModel: typeof model === 'string' ? model : (model as any).name || 'ModelRef' 
      });

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
      
      const isModelNotFoundError = err.message?.includes('NOT_FOUND') || err.message?.includes('not found');
      const isQuotaError = err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429');
      const isRetryableError = isQuotaError || err.message?.includes('503');

      if (isRetryableError && !isModelNotFoundError) {
        // More conservative backoff for quota errors
        const baseDelay = isQuotaError ? 5000 : 2000;
        const delay = Math.pow(2, attempts) * baseDelay;

        logger.warn({ module, step: 'RETRY', attempt: attempts, delay, error: err.message });
        await new Promise(r => setTimeout(r, delay));
      } else {
        logger.error({ module, step: 'API_FAILED', error: err.message });
        // Don't throw if we want the caller to use a fallback, or if it's a configuration error
        if (isModelNotFoundError) {
           return null; // Let the caller handle the null output
        }
        throw err;
      }
    }
  }
  return null;
}

/**
 * getAIResponse: High-level helper that attempts the configured primary provider
 * and falls back to the secondary provider (Google <-> Groq) if the primary
 * returns null or throws an unrecoverable error.
 */
export async function getAIResponse(module: string, params: any, maxAttempts = 3) {
  const primary = (process.env.AI_PROVIDER || 'google').trim().toLowerCase();
  const secondary = primary === 'google' ? 'groq' : 'google';

  // Try primary provider first
  try {
    const out = await generateWithRetry(module, params, maxAttempts, { provider: primary });
    if (out != null) return out;
    logger.warn({ module, step: 'FALLBACK_PRIMARY_NULL', primary });
  } catch (err: any) {
    logger.warn({ module, step: 'PRIMARY_FAILED', provider: primary, error: err?.message });
  }

  // Try secondary provider as fallback
  try {
    logger.info({ module, step: 'ATTEMPT_FALLBACK', fallback: secondary });
    const out2 = await generateWithRetry(module, params, maxAttempts, { provider: secondary });
    if (out2 != null) return out2;
    logger.warn({ module, step: 'FALLBACK_NULL', fallback: secondary });
  } catch (err: any) {
    logger.error({ module, step: 'FALLBACK_FAILED', fallback: secondary, error: err?.message });
  }

  // If both providers fail, return null to keep callers able to handle fallback behavior
  return null;
}
