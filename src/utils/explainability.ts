import type { TradeDecision } from '../logic/strategy/risk_assessment.js';

/**
 * @dev Human-readable trade explanation formatter.
 * Enhanced for Milestone 2 to show multi-dimensional risk breakdown.
 * Updated for Issue #110 to include live news highlights.
 */
export function formatExplanation(decision: TradeDecision): string {
  const time = new Date().toISOString();
  const actionEmoji = decision.action === 'BUY' ? '🟢' : decision.action === 'SELL' ? '🔴' : '🟡';

  const amountStr = (Number(decision.amountUsdScaled) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const confidencePct = (decision.confidence * 100).toFixed(0);
  const riskScore = (decision.riskScore * 100).toFixed(0);

  const b = decision.breakdown;
  const breakdownStr = `Market: ${(b.marketRisk * 100).toFixed(0)}% | Portfolio: ${(b.portfolioRisk * 100).toFixed(0)}% | Sentiment: ${(b.sentimentRisk * 100).toFixed(0)}% | AI-Score: ${(b.aiScore * 100).toFixed(0)}% | Bootstrap: ${(b.manualPenalty * 100).toFixed(0)}%`;

  let summary = `[${time}] ${actionEmoji} ${decision.action} ${decision.pair}`;

  if (decision.action !== 'HOLD') {
    summary += ` — ${amountStr}`;
  }

  const newsStr = decision.newsHighlights && decision.newsHighlights.length > 0
    ? `  News Highlights:  ${decision.newsHighlights.slice(0, 3).join(' | ')}`
    : '  News Highlights:  No significant news detected.';

  return (
    `${summary}\n` +
    `  Total Risk Score: ${riskScore}% (Confidence: ${confidencePct}%)\n` +
    `  Risk Breakdown:   ${breakdownStr}\n` +
    `  Reasoning:        ${decision.reasoning}\n` +
    `${newsStr}\n` +
    `  ${decision.marketData ? `Market Context:   Spread=${(decision.marketData.spread * 100).toFixed(4)}% | Volatility=${(decision.marketData.volatility * 100).toFixed(2)}%` : ''}`
  );
}
