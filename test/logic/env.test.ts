import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { validateEnv } from '../../src/logic/env.js';

describe('Environment Validation Unit Tests', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    it('should throw CriticalSecurityException if required variables are missing', () => {
        // GOOGLE_GENAI_API_KEY is now optional if AI_PROVIDER is not 'google'
        process.env.AI_PROVIDER = 'google';
        delete process.env.GOOGLE_GENAI_API_KEY;
        delete process.env.AGENT_PRIVATE_KEY;
        delete process.env.KRAKEN_API_KEY;
        delete process.env.KRAKEN_SECRET;
        delete process.env.INFURA_KEY;
        delete process.env.STRYKR_PRISM_API;
        delete process.env.NETWORK;

        expect(() => validateEnv()).to.throw(/Environment validation failed/);
    });

    it('should pass if all required variables are present', () => {
        process.env.AI_PROVIDER = 'google';
        process.env.GOOGLE_GENAI_API_KEY = 'test';
        process.env.AGENT_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.KRAKEN_API_KEY = 'test';
        process.env.KRAKEN_SECRET = 'test';
        process.env.INFURA_KEY = 'test';
        process.env.STRYKR_PRISM_API = 'test';
        process.env.NETWORK = 'sepolia';

        expect(() => validateEnv()).to.not.throw();
    });

    it('should pass with GROQ_API_KEY if AI_PROVIDER is groq', () => {
        process.env.AI_PROVIDER = 'groq';
        process.env.GROQ_API_KEY = 'test';
        delete process.env.GOOGLE_GENAI_API_KEY;
        process.env.AGENT_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.KRAKEN_API_KEY = 'test';
        process.env.KRAKEN_SECRET = 'test';
        process.env.INFURA_KEY = 'test';
        process.env.STRYKR_PRISM_API = 'test';
        process.env.NETWORK = 'sepolia';

        expect(() => validateEnv()).to.not.throw();
    });

    it('should throw if AI_PROVIDER is groq but GROQ_API_KEY is missing', () => {
        process.env.AI_PROVIDER = 'groq';
        delete process.env.GROQ_API_KEY;
        process.env.AGENT_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.KRAKEN_API_KEY = 'test';
        process.env.KRAKEN_SECRET = 'test';
        process.env.INFURA_KEY = 'test';
        process.env.STRYKR_PRISM_API = 'test';
        process.env.NETWORK = 'sepolia';

        expect(() => validateEnv()).to.throw(/AI_PROVIDER is set to 'groq' but GROQ_API_KEY is missing/);
    });
});
