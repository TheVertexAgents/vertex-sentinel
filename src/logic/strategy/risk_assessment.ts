import { logger } from '../../utils/logger.js';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getCachedAI, setCachedAI, generateWithRetry } from '../../utils/ai.js';
import { CriticalSecurityException } from '../errors.js';
import { loadAgentMetadata } from '../config.js';
import { getKrakenService } from '../../services/kraken_service.js';
import { getNewsFeed } from './news_feed.js';
import { AgentStackClient } from '../clients/agent_stack.js';

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
    model: googleAI.model('gemini-flash-latest'),
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

  throw new CriticalSecurityException(`Fail-Closed: AI Sentiment analysis failed for ${pair}. Verified-or-Die enforcement active.`);
}

/**
 * @dev Core Risk Assessment Strategy Logic.
 * Integrates Genkit AI reasoning with a manual bootstrap penalty model.
 */
export async function analyzeRisk(pair: string, amountUsdScaled: bigint): Promise<TradeDecision> {
  logger.info({ module: 'RISK_STRATEGY', step: 'ANALYSIS_START', pair });
  try {
    // 1. Fetch Market Data
    const kraken = getKrakenService();
    const ticker = await kraken.getTicker(pair);

    // 2. Fetch Portfolio & History
    const balance = await kraken.getBalance();
    const history = await kraken.getTradeHistory();

    // 3. Fetch Live News & Sentiment (Issue #110)
    const baseAsset = pair.split('/')[0].split('-')[0]; // Handle various pair formats
    const news = await getNewsFeed([baseAsset, 'BTC', 'ETH', 'SOL']);
    const sentiment = await getSentiment(pair);

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

    // Volume Penalty: scaled to prevent "whale" moves relative to bootstrap liquidity ($100k)
    const volumePenalty = Math.min(0.3, (Number(amountUsdScaled) / (loadAgentMetadata().usdScalingFactor * 1000)) * 0.3);

    // Sentiment Penalty (Issue #171): Directly penalize neutral/bearish sentiment
    // If score < 0.55 (barely bullish), we start applying a penalty.
    const sentimentPenalty = sentiment.score < 0.55 ? Math.min(0.5, (0.55 - sentiment.score) * 2) : 0;

    // Expected ROI Block (Issue #171)
    // Edge is (sentiment_score - 0.5) - spread_cost. 
    // We require a positive edge to proceed with a BUY.
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
      aiResult = await generateWithRetry('AI_RISK', {
        model: googleAI.model('gemini-flash-latest'),
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
    }

    if (!aiResult) {
      logger.warn({ module: 'AI_RISK', message: 'All AI attempts failed. Entering DEGRADED MODE (conservative baseline active).' });
      aiResult = {
        riskScore: 0.2, // Enhanced to conservative baseline (#143)
        marketRisk: 0.2,
        portfolioRisk: 0,
        sentimentRisk: 0.2,
        justification: "Degraded Mode: AI Engine Unavailable. Applying conservative risk baseline (0.2).",
      };
    }

    // 6. Arc L1 Verification Layer (Milestone 3 Integration)
    // The Sentinel MUST "hire" the AgentStack Orchestrator to verify local data.
    const verification = await AgentStackClient.verifyTrade(
      manualPenalty > 0.8 || aiResult.riskScore > 0.8 ? 'HOLD' : 'BUY', // Simplified intent for verification
      Math.max(manualPenalty, aiResult.riskScore),
      pair
    );

    const agentStackRequired = process.env.AGENTSTACK_REQUIRED === 'true';
    if (!verification.verified && agentStackRequired) {
      return {
        action: 'HOLD',
        pair,
        amountUsdScaled: 0n,
        confidence: 0,
        riskScore: 1.0,
        reasoning: `Security Halt: Verification Gateway Unreachable. Market Data Integrity cannot be guaranteed via Arc L1. Error: ${verification.error}`,
        newsHighlights: [],
        arcL1Proof: undefined,
        breakdown: { marketRisk: 0, portfolioRisk: 0, sentimentRisk: 0, manualPenalty: 0, aiScore: 1.0 }
      };
    } else if (!verification.verified) {
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

    // 7. Hybrid Enforcement (Fail-Closed) - Updated for Issue #171
    const riskScore = Math.max(manualPenalty, aiResult.riskScore);
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
    } else if (expectedRoi <= 0) {
      action = 'HOLD';
      reasons.push(`ROI Block: Negative expected return after spread (${(expectedRoi * 100).toFixed(2)}%).`);
    }

    return {
      action,
      pair,
      amountUsdScaled: action === 'HOLD' ? 0n : amountUsdScaled,
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
      marketData: { spread, volatility }
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
