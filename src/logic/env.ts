import { z } from 'zod';
import { CriticalSecurityException } from './errors.js';
import { logger } from '../utils/logger.js';

/**
 * @dev Schema for environment variable validation.
 * Mandated by Project Constitution v2.0.0.
 */
const envSchema = z.object({
  GOOGLE_GENAI_API_KEY: z.string().min(1, "GOOGLE_GENAI_API_KEY is required"),
  AGENT_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "AGENT_PRIVATE_KEY must be a valid 0x-prefixed 64-character hex string"),
  KRAKEN_API_KEY: z.string().min(1, "KRAKEN_API_KEY is required"),
  KRAKEN_SECRET: z.string().min(1, "KRAKEN_SECRET is required"),
  INFURA_KEY: z.string().min(1, "INFURA_KEY is required"),
  TX_CONFIRMATION_TIMEOUT: z.coerce.number().int().positive().default(90000),
  LOCAL_RPC_URL: z.string().url().default('http://127.0.0.1:8545'),
  LUNARCRUSH_KEY: z.string().min(1, "LUNARCRUSH_KEY is required"),
});

/**
 * @dev Validates process.env against the schema.
 * Throws CriticalSecurityException if validation fails (Fail-Closed).
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');

    throw new CriticalSecurityException(`Environment validation failed: ${errorMessages}`);
  }

  logger.info({ step: 'ENV_VALIDATED', message: 'Environment variables successfully validated.' });
  return result.data;
}
