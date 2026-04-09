import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { createSignedCheckpoint } from '../../src/utils/checkpoint.js';
import type { AgentMetadata } from '../../src/logic/config.js';
import type { TradeDecision } from '../../src/logic/strategy/risk_assessment.js';

describe('Checkpoint Utility Unit Tests', function () {
  const testPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const agent: AgentMetadata = {
    name: "Test Agent",
    version: "1.0.0",
    agentId: 1
  };

  const decision: TradeDecision = {
    action: 'BUY',
    pair: 'BTC/USD',
    amountUsdScaled: 10000n,
    confidence: 0.85,
    reasoning: "Test reasoning",
    riskScore: 0.1
  };

  const intentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const registryAddress = '0x0000000000000000000000000000000000000000';

  it('Should generate a valid EIP-712 signed checkpoint', async function () {
    const checkpoint = await createSignedCheckpoint(
        agent,
        decision,
        intentHash,
        50000,
        registryAddress,
        testPk,
        31337
    );

    expect(checkpoint.signature).to.match(/^0x[a-fA-F0-9]{130}$/);
    expect(checkpoint.reasoning).to.equal(decision.reasoning);
    expect(checkpoint.message.agentId).to.equal("1");
    expect(checkpoint.message).to.have.property('reasoningHash');
  });

  it('Should persist the checkpoint to logs/audit.json', async function () {
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    if (fs.existsSync(auditLogPath)) fs.unlinkSync(auditLogPath);

    await createSignedCheckpoint(
        agent,
        decision,
        intentHash,
        50000,
        registryAddress,
        testPk,
        31337
    );

    expect(fs.existsSync(auditLogPath)).to.be.true;
    const content = fs.readFileSync(auditLogPath, 'utf8');
    expect(content).to.contain(decision.reasoning);
  });
});
