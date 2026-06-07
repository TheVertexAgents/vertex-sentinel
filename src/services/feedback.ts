import { agentEvents } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * @title FeedbackService
 * @dev Manages user feedback and reputation adjustments.
 */
export class FeedbackService {
    private feedbackLog = path.join(process.cwd(), 'logs/feedback.json');

    constructor() {
        const dir = path.dirname(this.feedbackLog);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(this.feedbackLog)) fs.writeFileSync(this.feedbackLog, JSON.stringify([]));
    }

    public async submitFeedback(feedback: { agentId: string, rating: number, comment: string, tradeId?: string }) {
        logger.info({ module: 'FEEDBACK', step: 'SUBMIT', agentId: feedback.agentId, rating: feedback.rating });

        const submissions = JSON.parse(fs.readFileSync(this.feedbackLog, 'utf-8'));
        const entry = {
            ...feedback,
            timestamp: new Date().toISOString()
        };
        submissions.push(entry);
        fs.writeFileSync(this.feedbackLog, JSON.stringify(submissions, null, 2));

        // If high rating, boost reputation
        if (feedback.rating >= 4) {
            agentEvents.emit('reputation.update', { agentId: feedback.agentId, delta: 5 });
        }

        return { success: true };
    }

    public getFeedback() {
        return JSON.parse(fs.readFileSync(this.feedbackLog, 'utf-8'));
    }
}

export const feedbackService = new FeedbackService();
