import { TradeIntent, Authorization as BaseAuthorization, ValidationArtifact } from './generated_types.js';

export { TradeIntent, ValidationArtifact };

/**
 * @dev Extension types or local overrides that are not in the spec.
 */
export interface Authorization extends BaseAuthorization {
  traceId?: string;
  decision?: {
    action: string;
    riskScore: number;
    reasoning: string;
    breakdown: {
      marketRisk: number;
      portfolioRisk: number;
      sentimentRisk: number;
      manualPenalty: number;
      aiScore: number;
    };
    pair: string;
  };
}
