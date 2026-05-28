import { logger } from '../../utils/logger.js';
import axios from 'axios';

export interface WebThreat {
    asset: string;
    threatLevel: 'CRITICAL' | 'ELEVATED' | 'NOMINAL';
    summary: string;
    evidence: Array<{
        title: string;
        url: string;
    }>;
    timestamp: string;
    riskAction: 'HOLD' | 'MONITOR' | 'CLEAR';
    riskReason: string;
}

/**
 * @dev Client for the sentinel-web-oracle service.
 * Connects to port 3008 by default.
 */
export class WebOracleClient {
    private static oracleUrl = process.env.WEB_ORACLE_URL || 'http://localhost:3008';

    /**
     * @dev Fetches real-time threat intelligence for a specific asset.
     */
    static async getThreats(asset: string): Promise<WebThreat | null> {
        if (process.env.WEB_ORACLE_ENABLED !== 'true') {
            return null;
        }

        try {
            logger.info({ module: 'WEB_ORACLE', step: 'FETCH_THREATS', asset, url: this.oracleUrl });

            const response = await axios.post(`${this.oracleUrl}/analyze`, { asset }, { timeout: 120000 });
            return response.data as WebThreat;
        } catch (error: any) {
            logger.error({ module: 'WEB_ORACLE', step: 'FETCH_ERROR', error: error.message });
            return null;
        }
    }

    /**
     * @dev Checks if the oracle service is healthy.
     */
    static async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.oracleUrl}/health`);
            return response.data?.status === 'ok';
        } catch (e) {
            return false;
        }
    }
}
