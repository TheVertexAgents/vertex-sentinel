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

/**
 * @dev Fetches live news and social sentiment from LunarCrush (V4 Free Tier).
 * Falls back to neutral state on failure (Fail-Closed continuity).
 */
export async function getNewsFeed(assets: string[] = ['BTC', 'ETH', 'SOL']): Promise<NewsSummary> {
  const apiKey = process.env.LUNARCRUSH_KEY;

  if (!apiKey) {
    logger.warn({ module: 'NEWS_FEED', message: 'LUNARCRUSH_KEY not found. Operating in neutral mode.' });
    return getNeutralFallback(assets);
  }

  try {
    // Note: V4 Free Tier endpoints vary. Using a robust multi-asset fetch if possible,
    // or iterating if required. For V4, typically /public/coins/list/v2 or similar.
    // Based on research report, we use symbols as query param.
    const symbols = assets.join(',');
    const url = `https://api.lunarcrush.com/public/coins/list/v2?symbols=${symbols}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`LunarCrush API responded with status: ${response.status}`);
    }

    const data = await response.json() as any;

    if (!data || !data.data) {
      throw new Error('Invalid response format from LunarCrush');
    }

    const headlines: NewsHeadline[] = (data.data || []).slice(0, 8).map((item: any) => ({
      title: item.title || item.name || 'Market Update',
      source: 'LunarCrush',
      publishedAt: new Date().toISOString(), // Use current time if item.published_at is missing
      sentiment: item.sentiment ?? 0.5,
      impact: (item.galaxy_score > 70 || item.alt_rank < 10) ? 'high' : 'medium',
      instruments: assets,
    }));

    const socialSentiment: Record<string, number> = {};
    assets.forEach(asset => {
      const assetData = data.data?.find((d: any) => d.symbol === asset);
      socialSentiment[asset.toLowerCase()] = assetData ? (assetData.galaxy_score / 100 || 0.5) : 0.5;
    });

    return {
      timestamp: new Date().toISOString(),
      headlines,
      socialSentiment,
      overallSummary: 'Market news aggregated from social + headlines via LunarCrush.',
    };

  } catch (error: any) {
    logger.warn({
      module: 'NEWS_FEED',
      step: 'FETCH_FAILED',
      error: error.message,
      message: 'Entering neutral fallback mode for sentiment.'
    });
    return getNeutralFallback(assets);
  }
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
