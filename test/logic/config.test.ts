import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { loadAgentMetadata } from '../../src/logic/config.js';

describe('Agent Metadata Loader Unit Tests', () => {
    const agentIdPath = path.join(process.cwd(), 'agent-id.json');
    let originalAgentId: string | null = null;

    beforeEach(() => {
        if (fs.existsSync(agentIdPath)) {
            originalAgentId = fs.readFileSync(agentIdPath, 'utf8');
        }
    });

    afterEach(() => {
        if (originalAgentId) {
            fs.writeFileSync(agentIdPath, originalAgentId);
        }
    });

    it('should throw CriticalSecurityException if agent-id.json is missing', () => {
        if (fs.existsSync(agentIdPath)) fs.unlinkSync(agentIdPath);
        expect(() => loadAgentMetadata()).to.throw(/agent-id.json is missing/);
    });

    it('should throw CriticalSecurityException if agent-id.json is invalid', () => {
        fs.writeFileSync(agentIdPath, JSON.stringify({ name: "Test", version: "1.0", agentId: -1 }));
        expect(() => loadAgentMetadata()).to.throw(/Agent metadata validation failed/);
    });

    it('should correctly load and return valid metadata', () => {
        const mockMetadata = { name: "Sentinel-Test", version: "1.0.0", agentId: 42 };
        fs.writeFileSync(agentIdPath, JSON.stringify(mockMetadata));

        const result = loadAgentMetadata();
        expect(result.name).to.equal("Sentinel-Test");
        expect(result.version).to.equal("1.0.0");
        expect(result.agentId).to.equal(42);
    });
});
