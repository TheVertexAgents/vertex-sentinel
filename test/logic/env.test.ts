import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { validateEnv } from '../../src/logic/env.js';

describe('Environment Validation Unit Tests', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    it('should throw CriticalSecurityException if required variables are missing', () => {
        delete process.env.GOOGLE_GENAI_API_KEY;
        delete process.env.AGENT_PRIVATE_KEY;
        delete process.env.KRAKEN_API_KEY;
        delete process.env.KRAKEN_SECRET;
        delete process.env.INFURA_KEY;

        expect(() => validateEnv()).to.throw(/Environment validation failed/);
    });

    it('should pass if all required variables are present', () => {
        process.env.GOOGLE_GENAI_API_KEY = 'test';
        process.env.AGENT_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.KRAKEN_API_KEY = 'test';
        process.env.KRAKEN_SECRET = 'test';
        process.env.INFURA_KEY = 'test';

        expect(() => validateEnv()).to.not.throw();
    });
});
