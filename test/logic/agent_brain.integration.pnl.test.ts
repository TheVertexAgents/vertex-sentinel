import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';

describe('Agent Brain PnL Integration', () => {
  beforeEach(() => {
    // Set test env
    process.env.NODE_ENV = 'test';
    process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.NETWORK = 'local';
    process.env.GOOGLE_GENAI_API_KEY = 'test-genai';
    process.env.KRAKEN_API_KEY = 'test-key';
    process.env.KRAKEN_SECRET = 'test-secret';
    process.env.INFURA_KEY = 'test-infura';

    const pnlLogPath = path.join(process.cwd(), 'logs/pnl.json');
    if (fs.existsSync(pnlLogPath)) fs.unlinkSync(pnlLogPath);
  });

  it('should initialize PnLTracker and record trade after signIntent', async () => {
    const { PnLTracker } = await import('../../src/logic/pnl/tracker.js');
    const tracker = new PnLTracker();
    tracker.recordTrade({
        id: 'test',
        pair: 'BTC/USD',
        side: 'BUY',
        price: 60000,
        amount: 0.1,
        timestamp: new Date().toISOString()
    });

    const pnlLogPath = path.join(process.cwd(), 'logs/pnl.json');
    fs.writeFileSync(pnlLogPath, JSON.stringify(tracker.getSummary(), null, 2));

    expect(fs.existsSync(pnlLogPath), 'logs/pnl.json should exist').to.be.true;

    const pnlData = JSON.parse(fs.readFileSync(pnlLogPath, 'utf8'));
    expect(pnlData.summary.totalTrades).to.equal(1);
    expect(pnlData.positions['BTC/USD']).to.not.be.undefined;
  });
});
