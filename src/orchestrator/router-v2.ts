import express from 'express';

/**
 * @title RouterV2
 * @dev Stub for future API v2 routes.
 */
export const routerV2 = express.Router();

routerV2.get('/health', (_req, res) => {
    res.json({ status: 'OK', version: '2.0.0-alpha' });
});
