import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

export interface OCOParams {
    symbol: string;
    quantity: number;
    limitPrice: number;
    stopPrice: number;
    stopLimitPrice: number;
}

/**
 * @title OCOOrderService
 * @dev Manages One-Cancels-the-Other (OCO) orders.
 */
export class OCOOrderService {
    private activeOCOPath = path.join(process.cwd(), 'logs/active-oco.json');

    constructor() {
        const dir = path.dirname(this.activeOCOPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(this.activeOCOPath)) fs.writeFileSync(this.activeOCOPath, JSON.stringify([]));
    }

    public async placeOCO(params: OCOParams): Promise<any> {
        logger.info({ module: 'OCO', step: 'PLACE_ORDER', params });

        // For demo/hackathon, we simulate the OCO logic by tracking the two legs
        const ocoEntry = {
            id: Math.random().toString(36).substring(7),
            params,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        const active = JSON.parse(fs.readFileSync(this.activeOCOPath, 'utf8'));
        active.push(ocoEntry);
        fs.writeFileSync(this.activeOCOPath, JSON.stringify(active, null, 2));

        return ocoEntry;
    }
}

export const ocoOrderService = new OCOOrderService();
