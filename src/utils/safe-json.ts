import { logger } from './logger.js';
import { ERR_JSON_PARSE } from './constants.js';

/**
 * Safely parses a JSON string, returning a fallback value and logging an error 
 * if parsing fails instead of crashing the process.
 * 
 * @param data JSON string to parse
 * @param fallback Fallback value to return on error
 * @param context Optional context object for richer logging (e.g., traceId)
 * @returns Parsed JSON object or fallback
 */
export function safeParseJSON<T = any>(data: string, fallback: T, context?: Record<string, unknown>): T {
    try {
        return JSON.parse(data) as T;
    } catch (error: any) {
        logger.error({
            level: 'ERROR',
            module: 'SafeJSON',
            errorCode: ERR_JSON_PARSE,
            message: `Failed to parse JSON: ${error.message}`,
            rawLength: data ? data.length : 0,
            ...context
        });
        return fallback;
    }
}
