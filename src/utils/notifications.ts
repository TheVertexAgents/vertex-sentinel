import { logger } from '../utils/logger.js';
import fetch from 'node-fetch';

/**
 * @title NotificationService
 * @dev Handles sending alerts via Telegram and Email (SendGrid).
 */
export class NotificationService {
  /**
   * @dev Sends a message to a Telegram chat.
   */
  static async sendTelegram(message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      logger.warn({ module: 'Notifications', message: 'Telegram credentials missing, skipping alert.' });
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🚨 VERTEX SENTINEL ALERT 🚨\n\n${message}`,
          parse_mode: 'HTML'
        })
      });
      logger.info({ module: 'Notifications', step: 'TELEGRAM_SENT' });
    } catch (error: any) {
      logger.error({ module: 'Notifications', message: 'Failed to send Telegram alert', error: error.message });
    }
  }

  /**
   * @dev Sends an email via SendGrid.
   */
  static async sendEmail(subject: string, text: string) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      logger.warn({ module: 'Notifications', message: 'SendGrid API key missing, skipping email.' });
      return;
    }

    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: 'operator@vertex.agents' }] }], // In production, this would be the user's email
          from: { email: 'alerts@vertex.agents' },
          subject: `Vertex Sentinel: ${subject}`,
          content: [{ type: 'text/plain', value: text }]
        })
      });
      logger.info({ module: 'Notifications', step: 'EMAIL_SENT' });
    } catch (error: any) {
      logger.error({ module: 'Notifications', message: 'Failed to send email alert', error: error.message });
    }
  }
}
