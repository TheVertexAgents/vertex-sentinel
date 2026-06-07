import { agentEvents } from '../utils/event-bus.js';
import { apiKeyManager } from '../utils/api-key-manager.js';
import { sessionManager } from '../utils/session-manager.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * @title BetaAccessService
 * @dev Manages beta user registration and initial reputation.
 */
export class BetaAccessService {
    private betaUsersLog = path.join(process.cwd(), 'logs/beta-users.json');

    constructor() {
        const dir = path.dirname(this.betaUsersLog);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(this.betaUsersLog)) fs.writeFileSync(this.betaUsersLog, JSON.stringify([]));
    }

    public async registerBetaUser(address: string, role: 'operator' | 'observer' = 'operator') {
        logger.info({ module: 'BETA_ACCESS', step: 'REGISTER', address, role });

        // 1. Issue API Key
        const { key: apiKey } = await apiKeyManager.generateKey();
        const keys = apiKeyManager.loadKeys();
        keys.push({ key: apiKey, createdAt: new Date().toISOString() });
        apiKeyManager.saveKeys(keys);

        // 2. Register in Session DB
        await sessionManager.registerUser(apiKey, address, role === 'operator' ? 'admin' : 'viewer');

        // 3. Save to beta users log
        const users = JSON.parse(fs.readFileSync(this.betaUsersLog, 'utf-8'));
        const newUser = {
            address,
            role,
            apiKey,
            registeredAt: new Date().toISOString(),
            initialReputation: 50
        };
        users.push(newUser);
        fs.writeFileSync(this.betaUsersLog, JSON.stringify(users, null, 2));

        // 4. Emit reputation signal (simulated on-chain interaction)
        agentEvents.emit('reputation.update', { address, score: 50 });

        return { apiKey, address, role };
    }

    public getBetaUsers() {
        return JSON.parse(fs.readFileSync(this.betaUsersLog, 'utf-8'));
    }
}

export const betaAccessService = new BetaAccessService();
