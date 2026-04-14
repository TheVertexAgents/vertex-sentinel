import { describe, it } from 'mocha';
import { expect } from 'chai';
import { formatExplanation } from '../../src/utils/explainability.js';
import { TradeDecision } from '../../src/logic/strategy/risk_assessment.js';

describe('Explainability Utility Unit Tests', () => {
    it('should format a BUY decision correctly with color markers', () => {
        const decision: TradeDecision = {
            action: 'BUY',
            pair: 'BTC/USD',
            amountUsdScaled: 10000n,
            confidence: 0.9,
            riskScore: 0.1,
            reasoning: 'Stable market conditions',
            newsHighlights: [],
            breakdown: {
                marketRisk: 0.05,
                portfolioRisk: 0.02,
                sentimentRisk: 0.03,
                manualPenalty: 0.05,
                aiScore: 0.1
            },
            marketData: {
                spread: 0.002,
                volatility: 0.05
            }
        };

        const result = formatExplanation(decision);
        expect(result).to.contain('🟢 BUY');
        expect(result).to.contain('Confidence: 90%');
        expect(result).to.contain('Stable market conditions');
        expect(result).to.contain('Spread=0.2000%');
        expect(result).to.contain('Market: 5%');
    });

    it('should format a HOLD decision correctly with color markers', () => {
        const decision: TradeDecision = {
            action: 'HOLD',
            pair: 'BTC/USD',
            amountUsdScaled: 0n,
            confidence: 0.2,
            riskScore: 0.8,
            reasoning: 'High volatility detected',
            newsHighlights: [],
            breakdown: {
                marketRisk: 0.4,
                portfolioRisk: 0.2,
                sentimentRisk: 0.2,
                manualPenalty: 0.4,
                aiScore: 0.8
            },
            marketData: {
                spread: 0.01,
                volatility: 0.5
            }
        };

        const result = formatExplanation(decision);
        expect(result).to.contain('🟡 HOLD');
        expect(result).to.contain('Confidence: 20%');
        expect(result).to.contain('High volatility detected');
        expect(result).to.contain('Total Risk Score: 80%');
    });
});
