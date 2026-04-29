import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { logger } from './logger.js';

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })],
});

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
      const response = await ai.generate(params);
      return response.output;
    } catch (err: any) {
      attempts++;
      if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('503') || err.message?.includes('429')) {
        const delay = Math.pow(2, attempts) * 1000;
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
