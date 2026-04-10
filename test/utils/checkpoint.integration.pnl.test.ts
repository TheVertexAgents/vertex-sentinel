import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { createSignedCheckpoint } from '../../src/utils/checkpoint.js';
import type { TradeDecision } from '../../src/logic/strategy/risk_assessment.js';

describe('Checkpoint PnL Integration', () => {
  beforeEach(() => {
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    if (fs.existsSync(auditLogPath)) fs.unlinkSync(auditLogPath);
  });

  it('should include PnL metrics in signed checkpoints and persist to logs/audit.json', async () => {
    const agent = { name: 'Test Agent', version: '1.0.0', agentId: '1', agentAddress: '0x0123456789abcdef0123456789abcdef0123456789abcdef' };
    const decision: TradeDecision = {
      action: 'BUY' as const,
      pair: 'BTC/USD',
      amountUsdScaled: 10000n,
      confidence: 0.95,
      riskScore: 0.05,
      reasoning: 'Test reasoning',
      breakdown: {
        marketRisk: 0.01,
        portfolioRisk: 0.01,
        sentimentRisk: 0.01,
        manualPenalty: 0.02,
        aiScore: 0.05
      }
    };
    const pk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    // PnL metrics that should be included
    const pnlMetrics = {
        totalPnL: 123.45,
        realizedPnL: 100.00,
        unrealizedPnL: 23.45,
        roiPercent: 1.23
    };

    const checkpoint = await createSignedCheckpoint(agent as any, decision, pk as `0x${string}`, 11155111, pnlMetrics);

    expect(checkpoint.pnl).to.deep.equal(pnlMetrics);

    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    const lines = fs.readFileSync(auditLogPath, 'utf8').trim().split('\n');
    const lastEntry = JSON.parse(lines[lines.length - 1]);

    expect(lastEntry.pnl).to.deep.equal(pnlMetrics);
  });
});
