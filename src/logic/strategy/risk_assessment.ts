import { logger } from '../../utils/logger.js';
import { z } from 'genkit';
import { getCachedAI, setCachedAI, generateWithRetry } from '../../utils/ai.js';
import { CriticalSecurityException } from '../errors.js';
import { loadAgentMetadata } from '../config.js';
import { getKrakenService } from '../../services/kraken_service.js';
import { getNewsFeed } from './news_feed.js';
import { AgentStackClient } from '../clients/agent_stack.js';
import { KellyCriterion } from '../sizing/kelly.js';
import { orderBookService } from './order-book.js';

/**
 * @dev Strategy Output Schema.
 * Enhanced to meet Milestone 2 requirements for Intelligent Verifiability.
 * Updated for Issue #110 to include live news highlights.
 */
export const TradeDecisionSchema = z.object({
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  pair: z.string(),
  amountUsdScaled: z.bigint(),
  confidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(1),
  reasoning: z.string(),
  newsHighlights: z.array(z.string()),
  arcL1Proof: z.string().optional(),
  breakdown: z.object({
    marketRisk: z.number(),
    portfolioRisk: z.number(),
    sentimentRisk: z.number(),
    manualPenalty: z.number(),
    aiScore: z.number(),
  }),
  marketData: z.object({
    spread: z.number(),
    volatility: z.number(),
    marketImpactBps: z.number().optional(),
  }).optional(),
});

export type TradeDecision = z.infer<typeof TradeDecisionSchema>;



/**
 * @dev Live AI Sentiment API (Genkit)
 * Updated with exponential backoff and caching (#143).
 */
async function getSentiment(pair: string) {
  const cacheKey = `sentiment-${pair}`;
  const cached = getCachedAI(cacheKey);
  if (cached) return cached;

  const output = await generateWithRetry('SENTIMENT', {
    prompt: `Analyze the current real-world market sentiment for ${pair} crypto asset. Output JSON with headline, indicator (Bullish/Bearish/Neutral), and score (0.0 to 1.0).`,
    output: {
      format: 'json',
      schema: z.object({
        headline: z.string(),
        indicator: z.string(),
        score: z.number().min(0).max(1)
      })
    }
  });

  if (output) {
    logger.info({ module: 'SENTIMENT', step: 'FETCH_SUCCESS', pair });
    setCachedAI(cacheKey, output);
    return output;
  }

  // Graceful degradation: neutral sentiment baseline
  logger.warn({
    module: 'SENTIMENT',
    step: 'DEGRADED_MODE',
    pair,
    message: 'All AI attempts failed. Applying neutral sentiment baseline.'
  });
  return {
    headline: 'Degraded Mode: AI Sentiment Engine Unavailable',
    indicator: 'Neutral',
    score: 0.5
  };
}

/**
 * @dev Core Risk Assessment Strategy Logic.
 * Integrates Genkit AI reasoning with a manual bootstrap penalty model.
 */
export async function analyzeRisk(pair: string, amountUsdScaled: bigint): Promise<TradeDecision> {
  logger.info({ module: 'RISK_STRATEGY', step: 'ANALYSIS_START', pair });
  try {
    const kraken = getKrakenService();
    const baseAsset = pair.split('/')[0].split('-')[0];

    // Parallelize API calls for optimization (Sprint 1D)
    const [tickerResult, balanceResult, historyResult, newsResult, sentimentResult] = await Promise.allSettled([
      kraken.getTicker(pair),
      kraken.getBalance(),
      kraken.getTradeHistory(),
      getNewsFeed([baseAsset, 'BTC', 'ETH', 'SOL']),
      getSentiment(pair)
    ]);

    if (tickerResult.status === 'rejected') throw tickerResult.reason;

    const ticker = tickerResult.value;

    // Sentiment failure should not crash the system — use neutral fallback
    const sentiment = sentimentResult.status === 'fulfilled'
      ? sentimentResult.value
      : { headline: 'Sentiment Unavailable', indicator: 'Neutral', score: 0.5 };

    if (sentimentResult.status === 'rejected') {
      logger.warn({
        module: 'RISK_STRATEGY',
        step: 'SENTIMENT_DEGRADED',
        error: sentimentResult.reason?.message || 'Unknown'
      });
    }

    const balance = balanceResult.status === 'fulfilled' ? balanceResult.value : ({} as any);
    const history = historyResult.status === 'fulfilled' ? historyResult.value : ({ trades: {}, count: 0 } as any);
    const news = newsResult.status === 'fulfilled' ? newsResult.value : { headlines: [], socialSentiment: {}, overallSummary: 'News fallback' };

    // 4. Manual Penalty Model (Bootstrap Logic) - Hardened for Issue #171
    const ask = parseFloat(ticker.a[0]);
    const bid = parseFloat(ticker.b[0]);
    const spread = (ask - bid) / ask;
    const high24h = parseFloat(ticker.h[1]);
    const low24h = parseFloat(ticker.l[1]);
    const volatility = (high24h - low24h) / low24h;

    // Aggressive Spread Penalty: 0.5% spread is now a 0.2 penalty, 2% is 0.8 (Critical)
    const spreadPenalty = Math.min(0.8, (spread / 0.005) * 0.2); 
    
    // Volatility Penalty: 5% movement in 24h triggers 0.2 penalty
    const volatilityPenalty = Math.min(0.4, (volatility / 0.05) * 0.2);

    // Volume Penalty / Market Impact Analysis (v1.3.0)
    const amountUsd = Number(amountUsdScaled) / loadAgentMetadata().usdScalingFactor;
    let marketImpactBps = 0;
    const bestAsk = orderBookService.getBestAsk(pair);
    const { askDepth } = orderBookService.getMarketDepth(pair, 5);

    if (askDepth > 0 && bestAsk) {
        // Slippage estimate: (orderSize / liquidityAtLevel) × spread
        // Simplified for bootstrap: (amountUsd / askDepth) * spread * 10000
        marketImpactBps = Math.floor((amountUsd / askDepth) * spread * 10000);
    }

    let volumePenalty = Math.min(0.3, (amountUsd / 1000) * 0.3);
    if (marketImpactBps > 50) {
        logger.warn({ module: 'RISK_STRATEGY', step: 'HIGH_IMPACT_DETECTED', marketImpactBps });
        volumePenalty = Math.max(volumePenalty, 0.6); // 0.6 = HIGH_IMPACT threshold
    }

    // Sentiment Penalty (Issue #171): Directly penalize neutral/bearish sentiment
    // If score < 0.55 (barely bullish), we start applying a penalty.
    const sentimentPenalty = sentiment.score < 0.55 ? Math.min(0.5, (0.55 - sentiment.score) * 2) : 0;

    // Expected ROI Block (Issue #171)
    // Edge is (sentiment_score - 0.5) - spread_cost. 
    // We require a minimum ROI to proceed with a BUY.
    const minRoi = parseFloat(process.env.MIN_EXPECTED_ROI || '-0.002');
    const expectedEdge = sentiment.score - 0.5;
    const expectedRoi = expectedEdge - spread;

    // News-based manual penalty
    let newsPenalty = 0;
    if (news.headlines.some(h => h.impact === 'high' && h.sentiment < 0.4)) {
      newsPenalty = 0.6; // Increased from 0.5
    } else if (news.headlines.some(h => h.impact === 'medium' && h.sentiment < 0.4)) {
      newsPenalty = 0.3; // Increased from 0.2
    }

    const manualPenalty = Math.min(1.0, spreadPenalty + volatilityPenalty + volumePenalty + newsPenalty + sentimentPenalty);

    // 5. Genkit AI Risk Assessment
    const amountUsd = Number(amountUsdScaled) / loadAgentMetadata().usdScalingFactor;

    // Caching AI Risk Assessment (#143)
    // Key includes pair and rounded amount to allow some reuse
    const aiRiskCacheKey = `risk-${pair}-${Math.floor(amountUsd / 10)}`;
    let aiResult = getCachedAI(aiRiskCacheKey);

    if (!aiResult) {
      try {
        aiResult = await generateWithRetry('AI_RISK', {
          prompt: `You are the Vertex Sentinel Risk Specialist. Your mandate is to protect the agent's capital by identifying high-risk trade intents before they reach the blockchain.

Analyze the provided data and evaluate:
1. Market Risk: Based on Bid/Ask spread and volatility.
2. Portfolio Impact: Sizing of the trade relative to total allocation.
3. Historical Correlation: Is this strategy repeating past failures?
4. Sentiment Risk: Adverse news or indicators.

News Summary (Structured Data):
${JSON.stringify(news, null, 2)}

Instructions for weighing News:
- Market News and Social Sentiment OVERRIDE technical patterns when impact is high.
- If any headline has impact='high' AND sentiment<0.4 (e.g., regulatory exploit, major hack, government ban, or negative whale activity), identify this as critical sentiment risk.
- Social sentiment (0.0-1.0) is pre-processed and reliable: weight it heavily alongside news.

Trade Intent:
- Pair: ${pair}
- Amount: $${amountUsd.toFixed(2)}

Market Data:
${JSON.stringify(ticker, null, 2)}

Portfolio Balance:
${JSON.stringify(balance, null, 2)}

Recent History (last ${history.count} trades):
${JSON.stringify(history.trades, null, 2)}

Sentiment (LLM reasoning):
"${sentiment.headline}" (${sentiment.indicator})

Output your response in valid JSON format:
{
  "riskScore": number (0.0 to 1.0),
  "marketRisk": number (0.0 to 1.0),
  "portfolioRisk": number (0.0 to 1.0),
  "sentimentRisk": number (0.0 to 1.0),
  "justification": "concise string citing specific headlines if relevant"
}`,
          output: {
            format: 'json',
            schema: z.object({
              riskScore: z.number(),
              marketRisk: z.number(),
              portfolioRisk: z.number(),
              sentimentRisk: z.number(),
              justification: z.string(),
            })
          }
        });
        if (aiResult) {
          setCachedAI(aiRiskCacheKey, aiResult);
        }
      } catch (err: any) {
        logger.error({ module: 'AI_RISK', step: 'CATCH_BLOCK', error: err.message });
        aiResult = null;
      }
    }

    if (!aiResult) {
      logger.warn({ module: 'AI_RISK', message: 'All AI attempts failed. Entering DEGRADED MODE (conservative baseline active).' });
      aiResult = {
        riskScore: 0.2, // Enhanced to conservative baseline (#143)
        marketRisk: 0.2,
        portfolioRisk: 0,
        sentimentRisk: 0.2,
        justification: `Degraded Mode: AI Engine (${process.env.AI_PROVIDER || 'google'}) Unavailable. Applying conservative risk baseline (0.2).`,
      };
    }

    // 6. Arc L1 Verification Layer (Milestone 3 Integration)
    // The Sentinel MUST "hire" the AgentStack Orchestrator to verify local data.
    const agentStackRequired = process.env.AGENTSTACK_REQUIRED !== 'false';
    let verification: { verified: boolean; proof?: string; error?: string } = { verified: true, proof: 'SKIP_AGENTSTACK' };

    if (agentStackRequired) {
      const result = await AgentStackClient.verifyTrade(
        manualPenalty > 0.8 || aiResult.riskScore > 0.8 ? 'HOLD' : 'BUY', // Simplified intent for verification
        Math.max(manualPenalty, aiResult.riskScore),
        pair
      );
      verification = {
        verified: result.verified,
        proof: result.proof,
        error: result.error
      };

      if (!verification.verified) {
        logger.error({ module: 'RISK_ASSESSMENT', message: 'Fail-Closed: AgentStack verification failed. Blocking trade per Verified-or-Die rule.', error: verification.error });
        // We force a HOLD here to comply with the "Verified or Die" security mandate.
        return {
          action: 'HOLD',
          pair,
          amountUsdScaled: 0n,
          confidence: 0,
          riskScore: 1.0,
          reasoning: `Security Block: Arc L1 Verification failed (${verification.error}). Verified-or-Die enforcement active.`,
          newsHighlights: [],
          arcL1Proof: undefined,
          breakdown: { marketRisk: 0, portfolioRisk: 0, sentimentRisk: 0, manualPenalty: 0, aiScore: 1.0 }
        };
      }
    } else {
      logger.warn({ module: 'RISK_ASSESSMENT', step: 'AGENTSTACK_SKIPPED', message: 'AgentStack verification skipped (AGENTSTACK_REQUIRED=false)' });
    }

    // 7. Hybrid Enforcement (Fail-Closed) - Updated for Issue #171
    const riskScore = Math.max(manualPenalty, aiResult.riskScore);

    // Apply Kelly Criterion for Position Sizing Cap
    let kellyCap = 1.0;
    const fraction = parseFloat(process.env.KELLY_FRACTION || '0.25');
    if (history.count >= 5) { // Only apply Kelly after some history
        // Calculate historical win rate and avg win/loss
        const trades = Object.values(history.trades) as any[];
        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl < 0);

        const winRate = wins.length / trades.length;
        const avgWin = wins.reduce((a, b) => a + b.pnl, 0) / (wins.length || 1);
        const avgLoss = Math.abs(losses.reduce((a, b) => a + b.pnl, 0) / (losses.length || 1));

        kellyCap = KellyCriterion.getFractionalSize(winRate, avgWin, avgLoss, fraction);
        logger.info({ module: 'KELLY_SIZING', winRate, avgWin, avgLoss, kellyCap });
    }

    const confidence = 1.0 - riskScore;
    const confidenceThreshold = 0.2; // Equivalent to risk 0.8

    let action: 'BUY' | 'SELL' | 'HOLD' = 'BUY';
    const newsHighlights = news.headlines.map(h => `[${h.impact.toUpperCase()}] ${h.title} (${h.source})`);

    let reasons = [aiResult.justification];

    // ROI Check Reasoning
    reasons.push(`Expected ROI: ${(expectedRoi * 100).toFixed(2)}% (Edge: ${(expectedEdge * 100).toFixed(2)}%, Spread: ${(spread * 100).toFixed(2)}%)`);

    // Append top news highlights to reasoning
    if (newsHighlights.length > 0) {
      reasons.push(`News: ${newsHighlights.slice(0, 2).join(' | ')}`);
    }

    if (manualPenalty > 0.8) reasons.push(`Critical Manual Penalty: ${(manualPenalty * 100).toFixed(0)}%`);
    if (aiResult.riskScore > 0.8) reasons.push(`Critical AI Risk Score: ${(aiResult.riskScore * 100).toFixed(0)}%`);
    
    // Enforcement Logic
    if (confidence < confidenceThreshold) {
      action = 'HOLD';
      reasons.push("Fail-Closed: Risk threshold exceeded.");
    } else if (expectedRoi < minRoi) {
      action = 'HOLD';
      reasons.push(`ROI Block: Expected return (${(expectedRoi * 100).toFixed(2)}%) below threshold (${(minRoi * 100).toFixed(2)}%).`);
    }

    // Apply Kelly Cap to amountUsdScaled
    let finalAmountUsdScaled = amountUsdScaled;
    if (action !== 'HOLD' && kellyCap < 1.0) {
        const cappedAmount = BigInt(Math.floor(Number(amountUsdScaled) * kellyCap));
        if (cappedAmount < amountUsdScaled) {
            reasons.push(`Kelly Cap Applied: ${Math.round(kellyCap * 100)}%`);
            finalAmountUsdScaled = cappedAmount;
        }
    }

    return {
      action,
      pair,
      amountUsdScaled: action === 'HOLD' ? 0n : finalAmountUsdScaled,
      confidence,
      riskScore,
      reasoning: reasons.join(" | "),
      newsHighlights,
      arcL1Proof: verification.proof,
      breakdown: {
        marketRisk: aiResult.marketRisk,
        portfolioRisk: aiResult.portfolioRisk,
        sentimentRisk: aiResult.sentimentRisk,
        manualPenalty,
        aiScore: aiResult.riskScore
      },
      marketData: { spread, volatility, marketImpactBps }
    };

  } catch (error) {
    if (error instanceof CriticalSecurityException) throw error;

    if (process.env.NETWORK !== 'sepolia') {
      logger.warn({ module: 'RISK_ASSESSMENT', step: 'LOCAL_FALLBACK', error: error instanceof Error ? error.message : String(error) });
      return {
        action: 'HOLD',
        pair,
        amountUsdScaled: 0n,
        confidence: 0,
        riskScore: 1.0,
        reasoning: 'Fallback: AI/MCP Engine unavailable in local mode',
        newsHighlights: [],
        breakdown: { marketRisk: 0, portfolioRisk: 0, sentimentRisk: 0, manualPenalty: 0, aiScore: 1.0 }
      };
    }

    throw new CriticalSecurityException(`Risk assessment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
