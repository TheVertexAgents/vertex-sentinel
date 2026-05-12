import dotenv from 'dotenv';
import { logger } from './utils/logger.js';

/**
 * @dev Bootstrap environment variables before any other module loads.
 * This prevents race conditions where Genkit plugins initialize with 
 * empty process.env values due to ESM hoisting.
 */
dotenv.config();

logger.info({ 
  module: 'BOOTSTRAP', 
  step: 'ENV_LOADED', 
  aiProvider: process.env.AI_PROVIDER || 'google',
  groqKeyPresent: !!process.env.GROQ_API_KEY 
});
