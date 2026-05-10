import { logger } from '../../utils/logger.js';

export interface NewsHeadline {
  title: string;
  source: string;
  publishedAt: string;
  sentiment: number; // 0.0 to 1.0 (bearish to bullish)
  impact: 'low' | 'medium' | 'high';
  instruments: string[];
}

export interface NewsSummary {
  timestamp: string;
  headlines: NewsHeadline[];
  socialSentiment: Record<string, number>;
  overallSummary: string;
}

export interface SentimentProvider {
  name: string;
  getSentiment(assets: string[]): Promise<NewsSummary>;
}

class CoinGeckoProvider implements SentimentProvider {
  public name = 'CoinGecko';
  private SYMBOL_TO_ID: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'DOGE': 'dogecoin',
    'MATIC': 'polygon-ecosystem-native',
    'LINK': 'chainlink',
  };

  async getSentiment(assets: string[]): Promise<NewsSummary> {
    const ids = assets.map(a => this.SYMBOL_TO_ID[a.toUpperCase()] || a.toLowerCase()).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`CoinGecko responded with ${response.status}`);
    const data = await response.json() as any;

    const socialSentiment: Record<string, number> = {};
    const headlines: NewsHeadline[] = [];

    assets.forEach(asset => {
      const id = this.SYMBOL_TO_ID[asset.toUpperCase()] || asset.toLowerCase();
      const assetData = data[id];
      if (assetData && assetData.usd_24h_change !== undefined) {
        const change24h = assetData.usd_24h_change;
        const score = Math.min(0.85, Math.max(0.15, 0.5 + (change24h / 20)));
        socialSentiment[asset.toLowerCase()] = score;
        if (Math.abs(change24h) > 5) {
          headlines.push({
            title: `${asset} showing ${change24h > 0 ? 'strong bullish' : 'strong bearish'} momentum (${change24h.toFixed(2)}% 24h)`,
            source: 'CoinGecko Price Proxy',
            publishedAt: new Date().toISOString(),
            sentiment: score,
            impact: Math.abs(change24h) > 10 ? 'high' : 'medium',
            instruments: [asset],
          });
        }
      } else {
        socialSentiment[asset.toLowerCase()] = 0.5;
      }
    });

    return {
      timestamp: new Date().toISOString(),
      headlines,
      socialSentiment,
      overallSummary: 'Market sentiment proxied via CoinGecko 24h price momentum.',
    };
  }
}


/**
 * @dev Fetches market momentum from abstracted providers (default: CoinGecko).
 * Falls back to neutral state on failure (Fail-Closed continuity).
 */
export async function getNewsFeed(assets: string[] = ['BTC', 'ETH', 'SOL']): Promise<NewsSummary> {
  const provider = new CoinGeckoProvider();
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      return await provider.getSentiment(assets);
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      logger.warn({
        module: 'NEWS_FEED',
        step: 'FETCH_ATTEMPT_FAILED',
        provider: provider.name,
        attempt,
        error: error.message,
        nextAction: isLastAttempt ? 'FALLBACK' : 'RETRYING'
      });

      if (isLastAttempt) break;
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }

  return getNeutralFallback(assets);
}

function getNeutralFallback(assets: string[]): NewsSummary {
  const socialSentiment: Record<string, number> = {};
  assets.forEach(asset => {
    socialSentiment[asset.toLowerCase()] = 0.5;
  });

  return {
    timestamp: new Date().toISOString(),
    headlines: [],
    socialSentiment,
    overallSummary: 'Sentiment Data Unavailable: Operating in neutral fallback mode.',
  };
}
