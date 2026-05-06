import { logger } from '../../utils/logger.js';

/**
 * @dev Strykr PRISM API for canonical asset resolution.
 * Normalizes exchange-specific symbols (e.g. BTC/USD -> XXBTZUSD)
 */
export async function getAssetResolution(pair: string): Promise<{ symbol: string, precision: number }> {
  const apiKey = process.env.STRYKR_PRISM_API;
  const url = `https://api.prismapi.ai/resolve?pair=${encodeURIComponent(pair)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
        throw new Error(`PRISM API returned ${response.status}`);
    }

    const data = await response.json() as { symbol: string, precision: number };
    logger.info({ module: 'PRISM', step: 'METADATA_RESOLUTION', pair, symbol: data.symbol });
    return data;
  } catch (error: any) {
    logger.warn({ module: 'PRISM', message: 'PRISM API unavailable, using fallback', error: error.message });
    
    // Fallback: CCXT standard symbols are usually Pair/Quote
    // If it's something like BTC/USDC, CCXT handles it.
    // If it's XBTUSD (old style), we keep it as is or fix it to BTC/USD.
    let fallbackSymbol = pair;
    if (pair === 'XBTUSD') fallbackSymbol = 'BTC/USD';
    
    return { 
        symbol: fallbackSymbol, 
        precision: 8 // Default to 8 for Kraken
    };
  }
}
