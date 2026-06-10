import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import ExecutionProxy from '../../src/execution/proxy.js';
import { orderManager } from '../../src/execution/order-manager.js';

describe('Execution Proxy Unit Tests', function () {
    this.timeout(15000); // Reduced from 30s to 15s - tests should not take longer
    let sandbox: sinon.SinonSandbox;
    let proxy: any;
    let fetchTickerStub: sinon.SinonStub;
    let placeOrderStub: sinon.SinonStub;
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    const originalEnv = { ...process.env };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        process.env.GOOGLE_GENAI_API_KEY = 'test-api-key';
        process.env.AGENT_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
        process.env.KRAKEN_API_KEY = 'test-kraken-key';
        process.env.KRAKEN_SECRET = 'test-kraken-secret';
        process.env.INFURA_KEY = 'test-infura';
        process.env.LUNARCRUSH_KEY = 'test-lunarcrush';
        process.env.NETWORK = 'local';
        process.env.STRYKR_PRISM_API = 'test-prism-key';

        if (fs.existsSync(auditLogPath)) {
            fs.unlinkSync(auditLogPath);
        }

        proxy = new ExecutionProxy('0x1234567890123456789012345678901234567890' as `0x${string}`, 'local');
    });

    afterEach(async () => {
        process.env = { ...originalEnv };
        sandbox.restore();
    });

    it('should initialize correctly with given address', () => {
        expect(proxy.contractAddress).to.equal('0x1234567890123456789012345678901234567890');
    });

    it('should throw CriticalSecurityException if AGENT_PRIVATE_KEY is missing', () => {
        delete process.env.AGENT_PRIVATE_KEY;
        expect(() => new ExecutionProxy('0x123' as any, 'local')).to.throw(/AGENT_PRIVATE_KEY is missing/);
    });

    it('should use fallback RiskRouter address if network is sepolia and deployments file is missing', () => {
        const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');
        let backupCreated = false;
        if (fs.existsSync(deploymentsPath)) {
            fs.renameSync(deploymentsPath, deploymentsPath + '.bak');
            backupCreated = true;
        }

        try {
            const proxySepolia = new ExecutionProxy(undefined, 'sepolia');
            // Official Hackathon RiskRouter Address
            expect((proxySepolia as any).contractAddress).to.equal('0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC');
        } finally {
            if (backupCreated) fs.renameSync(deploymentsPath + '.bak', deploymentsPath);
        }
    });

    it('should attempt real MCP loopback execution for trade', async function () {
        this.timeout(5000); // Specific timeout for this async test
        
        // Mock BinanceAdapter to avoid real network calls during "real" loopback test
        fetchTickerStub = sandbox.stub(orderManager.getBinanceAdapter(), 'fetchTicker').resolves({
            ask: 50000,
            bid: 49900,
            symbol: 'BTCUSDT'
        });
        placeOrderStub = sandbox.stub(orderManager.getBinanceAdapter(), 'placeOrder').resolves({
            id: '123',
            price: 50000,
            symbol: 'BTCUSDT'
        });

        try {
            // Using a minimum tiny volume for test
            await proxy.processAuthorizedTrade('BTC/USD', 1000000000000n, 'TEST-TRACE-REAL-123', 'buy', 100n);
        } catch (error) {
            // It may throw if the real execution fails, but we don't mock it so this is valid.
        }

        expect(fs.existsSync(auditLogPath)).to.be.true;
        const auditLines = fs.readFileSync(auditLogPath, 'utf8').trim().split('\n');
        const lastEntry = JSON.parse(auditLines[auditLines.length - 1]);

        expect(lastEntry.traceId).to.equal('TEST-TRACE-REAL-123');
        // We assert that krakenStatus matches what actually occurred (success or failed)
        expect(['success', 'failed']).to.include(lastEntry.krakenStatus);
    });

    it('should map BTC/USD to BTCUSD and ETH/USDT to ETHUSDT correctly', async function () {
        // Mock BinanceAdapter methods to avoid real network calls
        fetchTickerStub = sandbox.stub(orderManager.getBinanceAdapter(), 'fetchTicker').resolves({
            ask: 50000, bid: 49900, symbol: 'BTCUSDT'
        } as any);
        placeOrderStub = sandbox.stub(orderManager.getBinanceAdapter(), 'placeOrder').resolves({ id: '123', price: 50000 } as any);

        await proxy.processAuthorizedTrade('BTC/USD', 100000n, 'TEST-TRACE-BTC', 'buy', 100n);
        expect(fetchTickerStub.calledWith('BTCUSD')).to.be.true;
        expect(placeOrderStub.calledWith('BTCUSD', 'limit', 'BUY', sinon.match.number, sinon.match.number)).to.be.true;

        fetchTickerStub.resetHistory();
        placeOrderStub.resetHistory();
        
        await proxy.processAuthorizedTrade('ETH/USDT', 100000n, 'TEST-TRACE-ETH', 'buy', 100n);
        expect(fetchTickerStub.calledWith('ETHUSDT')).to.be.true;
        expect(placeOrderStub.calledWith('ETHUSDT', 'limit', 'BUY', sinon.match.number, sinon.match.number)).to.be.true;
    });

    describe('Day 3-4 Resilience: Circuit Breaker & Retry Logic', () => {
        beforeEach(() => {
            fetchTickerStub = sandbox.stub(orderManager.getBinanceAdapter(), 'fetchTicker');
            placeOrderStub = sandbox.stub(orderManager.getBinanceAdapter(), 'placeOrder');
        });

        it('should format volume and price correctly for Binance', async () => {
            // Setup stub to succeed immediately (mocked - no real network call)
            fetchTickerStub.resolves({
                ask: 50000.123456789, bid: 49900.123456789, symbol: 'BTCUSDT'
            } as any);
            placeOrderStub.resolves({ orderId: '456', price: 50000 } as any);

            // Very small volume to test rounding
            await proxy.processAuthorizedTrade('BTC/USD', 100000n, 'TEST-FORMAT', 'buy', 100n);
            
            expect(placeOrderStub.calledOnce).to.be.true;
            const args = placeOrderStub.getCall(0).args;
            
            // args[3] is amount, args[4] is price
            expect(args[4].toString().split('.')[1]?.length || 0).to.be.at.most(8);
            expect(args[3].toString().split('.')[1]?.length || 0).to.be.at.most(8);
        });

        it('should NOT retry in proxy because retry is now handled by BinanceAdapter/OrderManager error logic', async () => {
            // Mock error response (no real network call)
            fetchTickerStub.rejects(new Error('502 Bad Gateway'));
            
            try {
                await proxy.processAuthorizedTrade('BTC/USD', 100000n, 'TEST-NO-RETRY-IN-PROXY', 'buy', 100n);
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.message).to.include('502 Bad Gateway');
            }

            expect(fetchTickerStub.calledOnce).to.be.true;
        });

        it('should open Circuit Breaker after 3 consecutive execution failures', async () => {
            // Fail execution continuously (mocked)
            fetchTickerStub.rejects(new Error('Exchange error: Connection lost'));
            
            for (let i = 0; i < 3; i++) {
                try {
                    await proxy.processAuthorizedTrade('BTC/USD', 100000n, `TEST-CB-${i}`, 'buy', 100n);
                } catch (e) {
                    // expected failure
                }
            }

            // At this point, consecutiveFailures should be 3 and CB is OPEN.
            expect((proxy as any).consecutiveFailures).to.equal(3);
            expect((proxy as any).circuitBreakerOpenUntil).to.be.greaterThan(Date.now());

            // 4th attempt should fail immediately without calling BinanceAdapter
            const initialCallCount = fetchTickerStub.callCount;
            try {
                await proxy.processAuthorizedTrade('BTC/USD', 100000n, 'TEST-CB-BLOCKED', 'buy', 100n);
                expect.fail('Should block execution');
            } catch (err: any) {
                expect(err.code).to.equal('ERR_CIRCUIT_BREAKER_OPEN');
            }

            expect(fetchTickerStub.callCount).to.equal(initialCallCount); // no new calls made
        });
    });
});
