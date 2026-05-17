import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { NotificationService } from './notifications.js';

const QUOTA_FILE = path.join(process.cwd(), 'data', 'ai_quota_usage.json');
const DAILY_LIMIT = process.env.AI_PROVIDER === 'groq' ? 14400 : 20;
const ALERT_THRESHOLD = 0.8; // 80%

export interface QuotaState {
  date: string;
  count: number;
  lastAlertSent?: number;
}

/**
 * @title QuotaTracker
 * @dev Manages persistent AI quota tracking to prevent over-usage.
 */
export class QuotaTracker {
  private static instance: QuotaTracker;
  private state: QuotaState;

  private constructor() {
    this.state = this.loadState();
    this.resetIfNewDay();
  }

  public static getInstance(): QuotaTracker {
    if (!QuotaTracker.instance) {
      QuotaTracker.instance = new QuotaTracker();
    }
    return QuotaTracker.instance;
  }

  private loadState(): QuotaState {
    try {
      if (fs.existsSync(QUOTA_FILE)) {
        return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
      }
    } catch (error) {
      logger.error({ module: 'QuotaTracker', step: 'LOAD_FAILED', error: String(error) });
    }
    return { date: new Date().toISOString().split('T')[0], count: 0 };
  }

  private saveState() {
    try {
      fs.writeFileSync(QUOTA_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error({ module: 'QuotaTracker', step: 'SAVE_FAILED', error: String(error) });
    }
  }

  private resetIfNewDay() {
    const today = new Date().toISOString().split('T')[0];
    if (this.state.date !== today) {
      logger.info({ module: 'QuotaTracker', step: 'RESET_DAY', oldDate: this.state.date, newDate: today });
      this.state = { date: today, count: 0 };
      this.saveState();
    }
  }

  public resetForTest() {
    this.state = { date: new Date().toISOString().split('T')[0], count: 0 };
    this.saveState();
  }

  public getUsage() {
    this.resetIfNewDay();
    return {
      used: this.state.count,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - this.state.count),
      percent: (this.state.count / DAILY_LIMIT) * 100
    };
  }

  public canRequest(): boolean {
    this.resetIfNewDay();
    return this.state.count < DAILY_LIMIT;
  }

  public async increment() {
    this.resetIfNewDay();
    this.state.count++;
    this.saveState();

    const usage = this.getUsage();
    if (usage.used === DAILY_LIMIT) {
      await NotificationService.sendTelegram(`<b>CRITICAL:</b> AI Quota fully exhausted (${usage.used}/${usage.limit}). Sentiment analysis will fail-closed.`);
    } else if (usage.used >= DAILY_LIMIT * ALERT_THRESHOLD && (!this.state.lastAlertSent || this.state.lastAlertSent < Math.floor(DAILY_LIMIT * ALERT_THRESHOLD))) {
      this.state.lastAlertSent = usage.used;
      this.saveState();
      await NotificationService.sendTelegram(`<b>WARNING:</b> AI Quota usage at ${usage.percent.toFixed(0)}% (${usage.used}/${usage.limit}).`);
    }
  }
}
