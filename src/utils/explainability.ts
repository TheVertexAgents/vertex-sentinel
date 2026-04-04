import type { TradeDecision } from '../logic/strategy/risk_assessment.js';

/**
 * @dev Human-readable trade explanation formatter.
 * Inspired by the reference template to provide clear "Why did we trade?" summaries.
 */
export function formatExplanation(decision: TradeDecision): string {
  const time = new Date().toISOString();
  const actionEmoji = decision.action === 'BUY' ? '🟢' : decision.action === 'SELL' ? '🔴' : '🟡';

  const amountStr = (Number(decision.amountUsdScaled) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const confidencePct = (decision.confidence * 100).toFixed(0);
  const riskScore = decision.riskScore ? (decision.riskScore * 100).toFixed(0) : 'N/A';

  let summary = `[${time}] ${actionEmoji} ${decision.action} ${decision.pair}`;

  if (decision.action !== 'HOLD') {
    summary += ` — ${amountStr}`;
  }

  return (
    `${summary}\n` +
    `  Confidence: ${confidencePct}% | Risk Score: ${riskScore}%\n` +
    `  Reasoning:  ${decision.reasoning}\n` +
    `  ${decision.marketData ? `Context:    Spread=${(decision.marketData.spread * 100).toFixed(4)}% | Volatility=${(decision.marketData.volatility * 100).toFixed(2)}%` : ''}`
  );
}
