import { expect } from 'chai';
import ExecutionProxy from '../src/execution/proxy.js';
import { orderManager } from '../src/execution/order-manager.js';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';

describe('ExecutionProxy Resilience', () => {
    let proxy: ExecutionProxy;
    let sandbox: sinon.SinonSandbox;
    let fetchTickerStub: sinon.SinonStub;
    let placeOrderStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        // Mock agent-id.json
        const agentIdPath = path.join(process.cwd(), 'agent-id.json');
        if (!fs.existsSync(agentIdPath)) {
            fs.writeFileSync(agentIdPath, JSON.stringify({ usdScalingFactor: 1e6 }));
        }

        process.env.AGENT_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.KRAKEN_API_KEY = 'test';
        process.env.KRAKEN_SECRET = 'test';
        process.env.INFURA_KEY = 'test';
        process.env.STRYKR_PRISM_API = 'test';
        process.env.NETWORK = 'local';
        process.env.AI_PROVIDER = 'groq';
        process.env.GROQ_API_KEY = 'test';

        proxy = new ExecutionProxy(undefined, 'local');

        // Fully mock OrderManager and BinanceAdapter to avoid real network calls
        const adapter = orderManager.getBinanceAdapter();
        fetchTickerStub = sandbox.stub(adapter, 'fetchTicker');
        placeOrderStub = sandbox.stub(adapter, 'placeOrder');

        // Default ticker mock (CCXT unified format)
        fetchTickerStub.resolves({ ask: 50000, bid: 49990, symbol: 'BTCUSD' });
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should retry on transient errors (503)', async () => {
        placeOrderStub.onCall(0).rejects({ message: 'Binance 503 Service Unavailable', code: 503 });
        placeOrderStub.onCall(1).resolves({ id: 'SUCCESS_TX', price: 50000 });

        await proxy.processAuthorizedTrade('BTC/USD', 1000000n);

        expect(placeOrderStub.callCount).to.equal(2);
    }).timeout(10000);

    it('should trip circuit breaker after 3 failures', async () => {
        placeOrderStub.rejects(new Error('Persistent Failure'));

        for (let i = 0; i < 3; i++) {
            try {
                await proxy.processAuthorizedTrade('BTC/USD', 1000000n);
            } catch (e) {}
        }

        try {
            await proxy.processAuthorizedTrade('BTC/USD', 1000000n);
            expect.fail('Should have thrown circuit breaker error');
        } catch (e: any) {
            expect(e.message).to.contain('Circuit Breaker is OPEN');
        }
    });

    it('should auto-recover after cooldown', async () => {
        placeOrderStub.rejects(new Error('Persistent Failure'));

        for (let i = 0; i < 3; i++) {
            try {
                await proxy.processAuthorizedTrade('BTC/USD', 1000000n);
            } catch (e) {}
        }

        // Manually reset state to simulate cooldown expiry
        (proxy as any).circuitBreakerOpenUntil = 0;
        (proxy as any).consecutiveFailures = 0;

        placeOrderStub.resolves({ id: 'RECOVERED_TX', price: 50000 });
        await proxy.processAuthorizedTrade('BTC/USD', 1000000n);

        expect(placeOrderStub.callCount).to.be.greaterThan(3);
    });
});
