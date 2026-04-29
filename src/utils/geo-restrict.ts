import { logger } from './logger.js';
import { CriticalSecurityException } from '../logic/errors.js';

/**
 * @dev Geographic Restriction Middleware for Vertex Sentinel.
 * Strictly adheres to the legal requirements of the project.
 * Prohibited regions: US, UK, North Korea, Iran.
 */

const PROHIBITED_COUNTRIES = ['US', 'GB', 'KP', 'IR'];

export interface GeoLocation {
    countryCode: string;
    region?: string;
    city?: string;
    ip: string;
}

/**
 * @dev Performs a simple IP-based lookup to determine the user's location.
 * Note: In a production environment, this should use a paid, reliable GeoIP database.
 */
export async function checkGeographicRestrictions(): Promise<void> {
    // Check if simulation is enabled
    if (process.env.SIMULATE_RESTRICTED_REGION === 'true') {
        throw new CriticalSecurityException(`Fail-Closed: Vertex Sentinel is not available in your region (Simulated Restriction).`);
    }

    try {
        // Using a public IP-API for demonstration purposes.
        const response = await fetch('http://ip-api.com/json/');
        if (!response.ok) {
            logger.warn({ module: 'GEO_RESTRICT', message: 'GeoIP service unavailable, falling back to Fail-Closed.' });
            throw new CriticalSecurityException('GeoIP service unavailable.');
        }

        const data = await response.json() as any;
        const countryCode = data.countryCode;

        logger.info({ module: 'GEO_RESTRICT', step: 'CHECK', country: countryCode, ip: data.query });

        if (PROHIBITED_COUNTRIES.includes(countryCode)) {
            if (process.env.BYPASS_GEO_RESTRICT === 'true') {
                logger.warn({ module: 'GEO_RESTRICT', step: 'BYPASS', country: countryCode, message: 'Bypassing restriction for testing purposes.' });
                return;
            }
            throw new CriticalSecurityException(`Fail-Closed: Vertex Sentinel is not available in ${countryCode}.`);
        }

    } catch (error: any) {
        if (error instanceof CriticalSecurityException) {
            throw error;
        }
        // Fail-Closed on network errors to ensure compliance
        logger.error({ module: 'GEO_RESTRICT', error: error.message });
        throw new CriticalSecurityException(`Geographic validation failed: ${error.message}`);
    }
}
