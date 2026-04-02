import { z } from 'zod';
import { CriticalSecurityException } from './errors.js';

/**
 * @dev Schema for environment variable validation.
 * Mandated by Project Constitution v2.0.0.
 */
const envSchema = z.object({
  GOOGLE_GENAI_API_KEY: z.string().min(1, "GOOGLE_GENAI_API_KEY is required"),
  AGENT_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "AGENT_PRIVATE_KEY must be a valid 0x-prefixed 64-character hex string"),
  KRAKEN_API_KEY: z.string().min(1, "KRAKEN_API_KEY is required"),
  KRAKEN_SECRET: z.string().min(1, "KRAKEN_SECRET is required"),
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

  return result.data;
}
