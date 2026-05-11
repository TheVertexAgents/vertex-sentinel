import { z } from 'zod';
import { CriticalSecurityException } from './errors.js';
import { logger } from '../utils/logger.js';
import { ERR_ENV_MISSING } from '../utils/constants.js';

/**
 * @dev Schema for environment variable validation.
 * Mandated by Project Constitution v2.0.0.
 */
const envSchema = z.object({
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  AGENT_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  AGENT_WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "AGENT_WALLET_ADDRESS must be a valid Ethereum address").optional(),
  KRAKEN_API_KEY: z.string().min(1, "KRAKEN_API_KEY is required"),
  KRAKEN_SECRET: z.string().min(1, "KRAKEN_SECRET is required"),
  INFURA_KEY: z.string().min(1, "INFURA_KEY is required"),
  ALCHEMY_KEY: z.string().optional(),
  STRYKR_PRISM_API: z.string().min(1, "STRYKR_PRISM_API is required"),
  NETWORK: z.string().min(1, "NETWORK is required"),
  TX_CONFIRMATION_TIMEOUT: z.coerce.number().int().positive().default(90000),
  LOCAL_RPC_URL: z.string().url().default('http://127.0.0.1:8545'),
  COINGECKO_API_KEY: z.string().optional(),
  AGENT_METADATA_URI: z.string().url("AGENT_METADATA_URI must be a valid URL").default("https://github.com/TheVertexAgents/vertex-sentinel/blob/main/metadata.json"),
  AGENT_STACK_URL: z.string().url().default('http://localhost:3003'),
  AGENTSTACK_REQUIRED: z.enum(['true', 'false']).default('true'),
  CIRCLE_API_KEY: z.string().optional(),
  CIRCLE_ENTITY_SECRET: z.string().optional(),
  AGENT_WALLET_ID: z.string().optional(),
  ORCHESTRATOR_WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  USE_CIRCLE_WAAS: z.enum(['true', 'false']).default('false'),
  MAINNET_RPC: z.string().url().optional(),
  BASE_RPC: z.string().url().optional(),
  ARBITRUM_RPC: z.string().url().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  KRAKEN_PAPER_MODE: z.enum(['true', 'false']).default('false'),
  HITL_THRESHOLD_USD: z.coerce.number().int().positive().default(1000),
  AI_MODEL: z.string().default('gemini-flash-latest'),
  AI_PROVIDER: z.enum(['google', 'groq']).default('google'),
  GROQ_API_KEY: z.string().optional(),
});

/**
 * @dev Validates process.env against the schema.
 * Throws CriticalSecurityException if validation fails (Fail-Closed).
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (result.success) {
    const data = result.data;
    if (data.USE_CIRCLE_WAAS === 'true') {
        if (!data.CIRCLE_API_KEY || !data.CIRCLE_ENTITY_SECRET || !data.AGENT_WALLET_ID || !data.AGENT_WALLET_ADDRESS || !data.ORCHESTRATOR_WALLET_ADDRESS) {
            throw new CriticalSecurityException("Circle WaaS is enabled but CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, AGENT_WALLET_ID, AGENT_WALLET_ADDRESS, or ORCHESTRATOR_WALLET_ADDRESS is missing.", ERR_ENV_MISSING);
        }
    } else if (!data.AGENT_PRIVATE_KEY) {
        throw new CriticalSecurityException("AGENT_PRIVATE_KEY is required when Circle WaaS is disabled.", ERR_ENV_MISSING);
    }

    // AI Provider Validation (Fail-Closed)
    if (data.AI_PROVIDER === 'google' && !data.GOOGLE_GENAI_API_KEY) {
      throw new CriticalSecurityException("AI_PROVIDER is set to 'google' but GOOGLE_GENAI_API_KEY is missing.", ERR_ENV_MISSING);
    }
    if (data.AI_PROVIDER === 'groq' && !data.GROQ_API_KEY) {
      throw new CriticalSecurityException("AI_PROVIDER is set to 'groq' but GROQ_API_KEY is missing.", ERR_ENV_MISSING);
    }
  }

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');

    throw new CriticalSecurityException(`Environment validation failed: ${errorMessages}`, ERR_ENV_MISSING);
  }

  logger.info({ step: 'ENV_VALIDATED', message: 'Environment variables successfully validated.' });
  return result.data;
}
