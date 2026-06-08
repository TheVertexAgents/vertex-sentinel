import { describe, it } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { analyzeRisk } from '../../src/logic/strategy/risk_assessment.js';
import { createSignedCheckpoint } from '../../src/utils/checkpoint.js';
import { loadAgentMetadata } from '../../src/logic/config.js';
import ExecutionProxy from '../../src/execution/proxy.js';
import type { Hex } from 'viem';
import { setCachedAI } from '../../src/utils/ai.js';
import { orderManager } from '../../src/execution/order-manager.js';
import sinon from 'sinon';

describe("Sentinel Full Loop Integration", function () {
  this.timeout(60000);

  it("Should assessment, sign, authorize on-chain, and execute on Kraken", async function () {
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    if (fs.existsSync(auditLogPath)) fs.unlinkSync(auditLogPath);
    
    process.env.NETWORK = 'local';
    process.env.GOOGLE_GENAI_API_KEY = 'test-api-key';
    process.env.AGENTSTACK_REQUIRED = 'false';
    
    setCachedAI('sentiment-BTC/USD', { headline: 'Integration Test', indicator: 'Neutral', score: 0.5 });
    setCachedAI('risk-BTC/USD-10', { riskScore: 0.1, marketRisk: 0, portfolioRisk: 0, sentimentRisk: 0, justification: 'Test' });

    const adapter = orderManager.getBinanceAdapter();
    const tickerStub = sinon.stub(adapter, 'fetchTicker').resolves({ ask: 60000, bid: 59900 } as any);
    const orderStub = sinon.stub(adapter, 'placeOrder').resolves({ id: 'MOCK-TX-123', price: 60000 } as any);

    const agentMetadata = loadAgentMetadata();
    const pk = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;

    const decision = await analyzeRisk('BTC/USD', 1000n);

    await createSignedCheckpoint(agentMetadata, decision, pk, 31337);

    const proxy = new ExecutionProxy('0x0000000000000000000000000000000000000000', 'local');

    const traceId = `TEST-E2E-LOOP-${Date.now()}`;
    await proxy.processAuthorizedTrade(decision.pair, decision.amountUsdScaled, traceId, decision.action, 100n);

    expect(fs.existsSync(auditLogPath)).to.be.true;
    const auditLines = fs.readFileSync(auditLogPath, 'utf8').trim().split('\n');
    const lastEntry = JSON.parse(auditLines[auditLines.length - 1]);

    expect(lastEntry.traceId).to.equal(traceId);
    expect(lastEntry.krakenStatus).to.equal('success');

    tickerStub.restore();
    orderStub.restore();
  });
});
