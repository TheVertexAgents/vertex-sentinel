import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { logger } from '../utils/logger.js';
import { OHLCVCollector } from './strategy/ohlcv_collector.js';
import { RiskRouterClient } from '../onchain/risk_router.js';
import { loadAgentMetadata } from './config.js';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })],
});

/**
 * @dev Dynamic Risk Calibrator.
 * Analyzes market conditions via Genkit and suggests updates to RiskRouter limits.
 */
export class RiskCalibrator {
  private collector = OHLCVCollector.getInstance();
  private router: RiskRouterClient;
  private agentId: bigint;
  private initialLimits: any = null;

  constructor(routerAddress: Hex, chainId: number, agentId: bigint) {
    this.router = new RiskRouterClient(routerAddress, chainId);
    this.agentId = agentId;
  }

  /**
   * @dev Runs the calibration loop.
   */
  public async runCalibration() {
    logger.info({ module: 'RiskCalibrator', step: 'START_CALIBRATION', agentId: this.agentId.toString() });

    try {
      // 1. Fetch current on-chain limits
      const currentParams = await this.router.riskParams(this.agentId);
      if (!this.initialLimits) {
          this.initialLimits = {
              maxPositionUsdScaled: BigInt(currentParams[0]),
              maxDrawdownBps: BigInt(currentParams[1]),
              maxTradesPerHour: BigInt(currentParams[2])
          };
      }

      // 2. Analyze Volatility
      const history = this.collector.getHistory('BTC/USDC'); // Assume primary pair for calibration
      const volatility = this.collector.calculateVolatility('BTC/USDC');

      // 3. Genkit Analysis
      const aiResponse = await ai.generate({
        model: googleAI.model('gemini-flash-latest'),
        prompt: `You are the Vertex Sentinel Institutional Risk Officer.
        Analyze the current market volatility and suggest adjustments to the RiskRouter position limits.

        Current Limits:
        - Max Position: $${(Number(currentParams[0]) / 100).toFixed(2)}
        - Max Trades/Hour: ${currentParams[2]}
        - Trailing Volatility (1m returns): ${(volatility * 100).toFixed(4)}%

        Historical Data (last ${history.length} minutes):
        ${JSON.stringify(history.slice(-10))}

        Mandate:
        - If volatility is high, reduce position limits.
        - If volatility is low, slightly increase position limits.
        - STAY WITHIN STRICT BOUNDS:
          - Max 20% change from current.
          - Max 2x from initial deployment limits ($${(Number(this.initialLimits.maxPositionUsdScaled) / 100).toFixed(2)}).

        Output JSON:
        {
          "suggestedMaxPositionScaled": number,
          "suggestedTradesPerHour": number,
          "reasoning": "string"
        }`,
        output: {
          format: 'json',
          schema: z.object({
            suggestedMaxPositionScaled: z.number(),
            suggestedTradesPerHour: z.number(),
            reasoning: z.string(),
          })
        }
      });

      const suggestion = aiResponse.output;
      if (!suggestion) throw new Error('AI failed to provide suggestion');

      // 4. Enforce Strict Bounds
      const currentMaxPos = BigInt(currentParams[0]);
      const initialMaxPos = this.initialLimits.maxPositionUsdScaled;

      let finalMaxPos = BigInt(Math.round(suggestion.suggestedMaxPositionScaled));

      // Cap at 20% change
      const upper20 = (currentMaxPos * 120n) / 100n;
      const lower20 = (currentMaxPos * 80n) / 100n;
      if (finalMaxPos > upper20) finalMaxPos = upper20;
      if (finalMaxPos < lower20) finalMaxPos = lower20;

      // Cap at 2x initial
      const absoluteCeiling = initialMaxPos * 2n;
      if (finalMaxPos > absoluteCeiling) finalMaxPos = absoluteCeiling;

      logger.info({
        module: 'RiskCalibrator',
        step: 'CALIBRATION_RESULT',
        suggested: suggestion.suggestedMaxPositionScaled,
        final: finalMaxPos.toString(),
        reasoning: suggestion.reasoning
      });

      // 5. In a real institutional setting, this might require a multi-sig or owner approval.
      // For this phase, we log the suggestion. Automatic update would use `router.setRiskParams` if owner.
      // this.router.setRiskParams(...)

    } catch (error) {
      logger.error({ module: 'RiskCalibrator', step: 'CALIBRATION_FAILED', error: error instanceof Error ? error.message : String(error) });
    }
  }
}
