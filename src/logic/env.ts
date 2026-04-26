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
  ALCHEMY_KEY: z.string().optional(),
  STRYKR_PRISM_API: z.string().min(1, "STRYKR_PRISM_API is required"),
  NETWORK: z.string().min(1, "NETWORK is required"),
  TX_CONFIRMATION_TIMEOUT: z.coerce.number().int().positive().default(90000),
  LOCAL_RPC_URL: z.string().url().default('http://127.0.0.1:8545'),
  LUNARCRUSH_KEY: z.string().optional(),
  AGENT_METADATA_URI: z.string().url("AGENT_METADATA_URI must be a valid URL").default("https://github.com/TheVertexAgents/vertex-sentinel/blob/main/metadata.json"),
  AGENT_STACK_URL: z.string().url().default('http://localhost:3003'),
  AGENTSTACK_REQUIRED: z.enum(['true', 'false']).default('true'),
  CIRCLE_API_KEY: z.string().optional(),
  CIRCLE_ENTITY_SECRET: z.string().optional(),
  USE_CIRCLE_WAAS: z.enum(['true', 'false']).default('false'),
  SENDGRID_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  KRAKEN_PAPER_MODE: z.enum(['true', 'false']).default('false'),
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
