import { Request, Response, NextFunction } from 'express';
import { apiKeyManager } from './api-key-manager.js';
import { sessionManager } from './session-manager.js';

/**
 * @title AuthMiddleware
 * @dev Middleware to authenticate requests via API Key or Session Token.
 */
export const authenticateRequest = async (req: Request, res: Response, next: NextFunction) => {
    // Exempt routes
    const exemptRoutes = ['/api/health', '/api/quota', '/api/beta/register'];
    const checkPath = req.path.replace(/^\/v1/, '');
    if (exemptRoutes.includes(checkPath)) {
        return next();
    }

    // 1. Check for Session Token (JWT)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const session = await sessionManager.verifySession(token);
            if (session) {
                (req as any).user = session;
                return next();
            }
        } catch (error) {
            // Fall through to API key check
        }
    }

    // 2. Check for API Key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
        const isValid = await apiKeyManager.validateKey(apiKey);
        if (isValid) {
            (req as any).user = { apiKey, role: 'admin' };
            return next();
        }
    }

    return res.status(401).json({ error: 'Unauthorized', message: 'Valid API Key or Session Token required' });
};
