import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { loadAgentMetadata } from '../config.js';

/**
 * @dev Schema for PRISM API response.
 * Mandated by Project Constitution §2.31.
 */
const AssetResolutionSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  precision: z.number().int().nonnegative("Precision must be a non-negative integer")
});

export type AssetResolution = z.infer<typeof AssetResolutionSchema>;

/**
 * @dev Strykr PRISM API for canonical asset resolution.
 * Normalizes exchange-specific symbols (e.g. BTC/USD -> XXBTZUSD)
 */
export async function getAssetResolution(pair: string): Promise<AssetResolution> {
  const apiKey = process.env.STRYKR_PRISM_API;
  const url = `https://api.prismapi.ai/resolve?pair=${encodeURIComponent(pair)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000) // 5-second timeout as per spec FR-001
    });

    if (!response.ok) {
        throw new Error(`PRISM API returned ${response.status}`);
    }

    const rawData = await response.json();
    
    // Zod validation (Constitution §2.31, Spec FR-002)
    const result = AssetResolutionSchema.safeParse(rawData);
    
    if (!result.success) {
        const errorDetails = result.error.errors.map(e => e.message).join(', ');
        throw new Error(`PRISM Schema Validation Failed: ${errorDetails}`);
    }

    const data = result.data;
    logger.info({ 
        module: 'PRISM', 
        step: 'PRISM_RESOLVED', 
        pair, 
        symbol: data.symbol,
        precision: data.precision
    });
    
    return data;

  } catch (error: any) {
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('timeout');
    
    logger.warn({ 
        module: 'PRISM', 
        step: isTimeout ? 'PRISM_TIMEOUT' : 'PRISM_FALLBACK_TRIGGERED',
        pair,
        message: 'PRISM API unavailable or invalid, using fallback', 
        error: error.message 
    });
    
    // Fallback: CCXT standard symbols are usually Pair/Quote
    // Default to input pair and precision 8 (Spec FR-003)
    let fallbackSymbol = pair;
    if (pair === 'XBTUSD') fallbackSymbol = 'BTC/USD';
    
    return { 
        symbol: fallbackSymbol, 
        precision: loadAgentMetadata()?.prismDefaultPrecision || 8 
    };
  }
}
