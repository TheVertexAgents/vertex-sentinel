import { expect } from 'chai';
import ExecutionProxy from '../src/execution/proxy.js';
import { getKrakenService } from '../src/services/kraken_service.js';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';

describe('ExecutionProxy Resilience', () => {
    let proxy: ExecutionProxy;
    let krakenStub: any;

    beforeEach(() => {
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

        const kraken = getKrakenService();
        krakenStub = sinon.stub(kraken);

        // Default ticker mock
        krakenStub.getTicker.resolves({ a: ['50000'], b: ['49990'] });
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should retry on transient errors (503)', async () => {
        krakenStub.placeOrder.onCall(0).rejects({ message: 'Kraken 503 Service Unavailable', code: 503 });
        krakenStub.placeOrder.onCall(1).resolves({ txid: ['SUCCESS_TX'] });

        await proxy.processAuthorizedTrade('BTC/USD', 1000000n);

        expect(krakenStub.placeOrder.callCount).to.equal(2);
    }).timeout(10000);

    it('should trip circuit breaker after 3 failures', async () => {
        krakenStub.placeOrder.rejects(new Error('Persistent Failure'));

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
        krakenStub.placeOrder.rejects(new Error('Persistent Failure'));

        for (let i = 0; i < 3; i++) {
            try {
                await proxy.processAuthorizedTrade('BTC/USD', 1000000n);
            } catch (e) {}
        }

        // Manually reset state to simulate cooldown expiry
        (proxy as any).circuitBreakerOpenUntil = 0;
        (proxy as any).consecutiveFailures = 0;

        krakenStub.placeOrder.resolves({ txid: ['RECOVERED_TX'] });
        await proxy.processAuthorizedTrade('BTC/USD', 1000000n);

        expect(krakenStub.placeOrder.callCount).to.be.greaterThan(3);
    });
});
