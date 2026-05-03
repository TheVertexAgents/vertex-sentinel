import { expect } from 'chai';
import { agentEvents } from '../../src/orchestrator/socket-server.js';
import { signIntent } from '../../src/logic/agent_brain.js';
import type { TradeIntent } from '../../src/logic/types.js';
import type { Hex } from 'viem';

describe('Manual Approval Flow', () => {
    const mockIntent: TradeIntent = {
        agentId: 42n,
        agentWallet: '0x1234567890123456789012345678901234567890' as Hex,
        pair: 'BTC/USDC',
        action: 'BUY',
        amountUsdScaled: 10000n,
        maxSlippageBps: 100n,
        nonce: 1n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };
    const mockPk = '0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd' as Hex;

    afterEach(() => {
        // Reset AI mode to auto
        agentEvents.emit('ai.config_changed', { enabled: true });
    });

    it('should queue intent in manual mode and approve via event', async () => {
        // Switch to manual mode
        agentEvents.emit('ai.config_changed', { enabled: false });

        const pendingPromise = new Promise<string>((resolve) => {
            agentEvents.once('intent.pending', (data) => {
                resolve(data.traceId);
            });
        });

        // Start signIntent (it should return a promise that waits for approval)
        const signPromise = signIntent(mockIntent, mockPk);

        const pendingTraceId = await pendingPromise;
        expect(pendingTraceId).to.not.be.null;

        // Emit approval
        agentEvents.emit('intent.approve', { traceId: pendingTraceId });

        const result = await signPromise;
        expect(result).to.have.property('isAllowed');
    });

    it('should reject intent when rejected via event', async () => {
        agentEvents.emit('ai.config_changed', { enabled: false });

        const pendingPromise = new Promise<string>((resolve) => {
            agentEvents.once('intent.pending', (data) => {
                resolve(data.traceId);
            });
        });

        const signPromise = signIntent(mockIntent, mockPk);

        const pendingTraceId = await pendingPromise;

        agentEvents.emit('intent.reject', { traceId: pendingTraceId });

        const result = await signPromise;
        expect(result.isAllowed).to.be.false;
        expect(result.reason).to.equal('Manual rejection by user');
    });
});
