import { expect } from 'chai';
import { ApiKeyManager } from '../src/utils/api-key-manager.js';
import fs from 'fs';
import path from 'path';

describe('ApiKeyManager', () => {
    const manager = ApiKeyManager.getInstance();
    const keyPath = path.join(process.cwd(), 'logs/api-keys.enc.json');

    beforeEach(() => {
        if (fs.existsSync(keyPath)) {
            fs.unlinkSync(keyPath);
        }
    });

    it('should generate a valid key format', () => {
        const { key, secret } = manager.generateKey();
        expect(key).to.match(/^[0-9a-f-]{36}\.[0-9a-f]{16}$/);
        expect(secret).to.have.lengthOf(64);
    });

    it('should save and load keys correctly', () => {
        const keyData = { key: 'test-key', secret: 'test-secret' };
        manager.saveKeys([keyData]);

        const loaded = manager.loadKeys();
        expect(loaded).to.have.lengthOf(1);
        expect(loaded[0].key).to.equal('test-key');
    });

    it('should rotate keys and keep old ones with expiry', () => {
        const first = manager.rotateKey();
        const second = manager.rotateKey();

        const keys = manager.loadKeys();
        expect(keys).to.have.lengthOf(2);

        const oldKey = keys.find(k => k.key === first.key);
        const newKey = keys.find(k => k.key === second.key);

        expect(oldKey.expiresAt).to.not.be.undefined;
        expect(newKey.expiresAt).to.be.undefined;
    });

    it('should cleanup expired keys', () => {
        const expiredKey = {
            key: 'expired',
            secret: 'secret',
            expiresAt: new Date(Date.now() - 1000).toISOString()
        };
        manager.saveKeys([expiredKey]);

        manager.rotateKey();
        const keys = manager.loadKeys();

        expect(keys.find(k => k.key === 'expired')).to.be.undefined;
        expect(keys).to.have.lengthOf(1);
    });
});
