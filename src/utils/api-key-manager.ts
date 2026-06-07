import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const KEY_STORE_PATH = path.join(process.cwd(), 'logs/api-keys.enc.json');
const ALGORITHM = 'aes-256-gcm';

/**
 * @title ApiKeyManager
 * @dev Manages generation, rotation, and encrypted storage of API keys.
 */
export class ApiKeyManager {
    private static instance: ApiKeyManager;
    private secret: string;

    private constructor() {
        this.secret = process.env.API_KEY_SECRET || 'default-secret-change-me';
        if (this.secret === 'default-secret-change-me' && process.env.NODE_ENV === 'production') {
            logger.warn({ module: 'API_KEY_MANAGER', step: 'INSECURE_SECRET', message: 'Using default secret in production!' });
        }
    }

    public static getInstance(): ApiKeyManager {
        if (!ApiKeyManager.instance) {
            ApiKeyManager.instance = new ApiKeyManager();
        }
        return ApiKeyManager.instance;
    }

    /**
     * @dev Generates a new API key (UUID v4 + HMAC signature)
     */
    public generateKey(): { key: string; secret: string } {
        const keyId = crypto.randomUUID();
        const keySecret = crypto.randomBytes(32).toString('hex');
        const hmac = crypto.createHmac('sha256', this.secret);
        hmac.update(`${keyId}.${keySecret}`);
        const key = `${keyId}.${hmac.digest('hex').substring(0, 16)}`;
        return { key, secret: keySecret };
    }

    /**
     * @dev Encrypts and stores keys
     */
    public saveKeys(keys: any[]): void {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, crypto.scryptSync(this.secret, 'salt', 32), iv);

        const encrypted = Buffer.concat([cipher.update(JSON.stringify(keys), 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        const storage = {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            data: encrypted.toString('hex')
        };

        if (!fs.existsSync(path.dirname(KEY_STORE_PATH))) {
            fs.mkdirSync(path.dirname(KEY_STORE_PATH), { recursive: true });
        }
        fs.writeFileSync(KEY_STORE_PATH, JSON.stringify(storage));
    }

    /**
     * @dev Decrypts and loads keys
     */
    public loadKeys(): any[] {
        if (!fs.existsSync(KEY_STORE_PATH)) return [];

        try {
            const storage = JSON.parse(fs.readFileSync(KEY_STORE_PATH, 'utf8'));
            const iv = Buffer.from(storage.iv, 'hex');
            const authTag = Buffer.from(storage.authTag, 'hex');
            const encrypted = Buffer.from(storage.data, 'hex');

            const decipher = crypto.createDecipheriv(ALGORITHM, crypto.scryptSync(this.secret, 'salt', 32), iv);
            decipher.setAuthTag(authTag);

            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
            return JSON.parse(decrypted.toString('utf8'));
        } catch (error) {
            logger.error({ module: 'API_KEY_MANAGER', step: 'LOAD_FAILED', error: (error as Error).message });
            return [];
        }
    }

    /**
     * @dev Rotates a key by generating a new one and keeping the old one for 24h
     */
    public rotateKey(): { key: string; expiresAt: string } {
        const keys = this.loadKeys();
        const now = Date.now();

        // Mark old keys for expiration if not already marked
        keys.forEach(k => {
            if (!k.expiresAt) {
                k.expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
            }
        });

        // Generate new key
        const { key, secret } = this.generateKey();
        keys.push({ key, secret, createdAt: new Date(now).toISOString() });

        // Cleanup expired keys
        const filteredKeys = keys.filter(k => !k.expiresAt || new Date(k.expiresAt).getTime() > now);

        this.saveKeys(filteredKeys);

        return {
            key,
            expiresAt: 'never'
        };
    }

    /**
     * @dev Validates an API key
     */
    public async validateKey(key: string): Promise<boolean> {
        const keys = this.loadKeys();
        const found = keys.find(k => k.key === key);
        if (!found) return false;

        if (found.expiresAt && new Date(found.expiresAt).getTime() < Date.now()) {
            return false;
        }

        return true;
    }
}

export const apiKeyManager = ApiKeyManager.getInstance();
