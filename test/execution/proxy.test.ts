import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import ExecutionProxy from '../../src/execution/proxy.js';
import { CriticalSecurityException } from '../../src/logic/errors.js';

describe('Execution Proxy Unit Tests', () => {
    let proxy: any;
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        process.env.INFURA_KEY = 'test-infura';
        process.env.NETWORK = 'local';

        if (fs.existsSync(auditLogPath)) {
            fs.unlinkSync(auditLogPath);
        }

        proxy = new ExecutionProxy('0x1234567890123456789012345678901234567890' as `0x${string}`, 'local');
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        sinon.restore();
    });

    it('should initialize correctly with given address', () => {
        expect(proxy.contractAddress).to.equal('0x1234567890123456789012345678901234567890');
    });

    it('should throw CriticalSecurityException if AGENT_PRIVATE_KEY is missing', () => {
        delete process.env.AGENT_PRIVATE_KEY;
        expect(() => new ExecutionProxy('0x123' as any, 'local')).to.throw(/AGENT_PRIVATE_KEY is missing/);
    });

    it('should throw CriticalSecurityException if network is sepolia and deployments file is missing', () => {
        const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');
        let backupCreated = false;
        if (fs.existsSync(deploymentsPath)) {
            fs.renameSync(deploymentsPath, deploymentsPath + '.bak');
            backupCreated = true;
        }

        try {
            expect(() => new ExecutionProxy(undefined, 'sepolia')).to.throw(/deployments_sepolia.json is missing/);
        } finally {
            if (backupCreated) fs.renameSync(deploymentsPath + '.bak', deploymentsPath);
        }
    });

    it('should log an audit entry for successful trade (mocked MCP)', async () => {
        const mockMcpClient = {
            callTool: sinon.stub().resolves({
                content: [{
                    text: JSON.stringify({
                        txid: ['O123-SUCCESS'],
                        price: 50000
                    })
                }]
            })
        };
        (proxy as any).mcpClient = mockMcpClient;

        // Using a small volume to avoid parse errors if any internal validation happens
        await proxy.executeOnKraken('BTC/USD', 1000000000000000000n, 'TEST-TRACE-123');

        expect(fs.existsSync(auditLogPath)).to.be.true;
        const auditLines = fs.readFileSync(auditLogPath, 'utf8').trim().split('\n');
        const lastEntry = JSON.parse(auditLines[auditLines.length - 1]);

        expect(lastEntry.traceId).to.equal('TEST-TRACE-123');
        expect(lastEntry.orderId).to.equal('O123-SUCCESS');
        expect(lastEntry.krakenStatus).to.equal('success');
    });

    it('should throw CriticalSecurityException and log audit for failed trade', async () => {
        const mockMcpClient = {
            callTool: sinon.stub().rejects(new Error('Exchange Timeout'))
        };
        (proxy as any).mcpClient = mockMcpClient;

        try {
            await proxy.executeOnKraken('BTC/USD', 1000000000000000000n, 'TEST-TRACE-456');
            expect.fail('Should have thrown CriticalSecurityException');
        } catch (error: any) {
            expect(error).to.be.instanceOf(CriticalSecurityException);
            expect(error.message).to.contain('Execution failure: Exchange Timeout');
        }

        const auditLines = fs.readFileSync(auditLogPath, 'utf8').trim().split('\n');
        const lastEntry = JSON.parse(auditLines[auditLines.length - 1]);
        expect(lastEntry.traceId).to.equal('TEST-TRACE-456');
        expect(lastEntry.krakenStatus).to.equal('failed');
    });
});
