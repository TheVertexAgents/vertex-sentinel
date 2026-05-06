import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { QuotaTracker } from '../../src/utils/quota-tracker.js';

describe('QuotaTracker', () => {
  const QUOTA_FILE = path.join(process.cwd(), 'data', 'ai_quota_usage.json');

  beforeEach(() => {
    if (fs.existsSync(QUOTA_FILE)) {
      fs.unlinkSync(QUOTA_FILE);
    }
    // @ts-ignore - reset singleton for testing
    QuotaTracker.instance = undefined;
  });

  it('should track usage and persist to file', async () => {
    const tracker = QuotaTracker.getInstance();
    expect(tracker.canRequest()).to.be.true;

    await tracker.increment();
    const usage = tracker.getUsage();
    expect(usage.used).to.equal(1);

    expect(fs.existsSync(QUOTA_FILE)).to.be.true;
    const stored = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
    expect(stored.count).to.equal(1);
  });

  it('should exhaust quota after 20 requests', async () => {
    const tracker = QuotaTracker.getInstance();
    for (let i = 0; i < 20; i++) {
      expect(tracker.canRequest()).to.be.true;
      await tracker.increment();
    }
    expect(tracker.canRequest()).to.be.false;
    const usage = tracker.getUsage();
    expect(usage.used).to.equal(20);
    expect(usage.remaining).to.equal(0);
  });

  it('should reset quota on a new day', async () => {
    const tracker = QuotaTracker.getInstance();
    await tracker.increment();

    // Manually manipulate state to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // @ts-ignore - accessing private state for testing
    tracker.state.date = yesterdayStr;

    expect(tracker.getUsage().used).to.equal(0);
    expect(tracker.canRequest()).to.be.true;
  });
});
