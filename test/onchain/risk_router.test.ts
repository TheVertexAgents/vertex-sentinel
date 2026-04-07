import { describe, it } from 'mocha';
import { expect } from 'chai';
import { RiskRouterClient } from '../../src/onchain/risk_router.js';
import { TradeIntent } from '../../src/logic/types.js';
import { Hex } from 'viem';

describe('Risk Router Client Unit Tests', () => {
    const routerAddress: Hex = '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC';
    const chainId = 11155111;
    const client = new RiskRouterClient(routerAddress, chainId);

    const mockIntent: TradeIntent = {
        agentId: 1n,
        agentWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        pair: 'BTC/USD',
        action: 'BUY',
        amountUsdScaled: 10000n,
        maxSlippageBps: 100n,
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };

    const privateKey: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    it('should compute an intent hash correctly', () => {
        const hash = client.computeIntentHash(mockIntent);
        expect(hash).to.match(/^0x/);
        expect(hash).to.have.lengthOf(66); // 32 bytes + 0x
    });

    it('should sign an intent with EIP-712', async () => {
        const signature = await client.signIntent(mockIntent, privateKey);
        expect(signature).to.match(/^0x/);
        expect(signature).to.have.lengthOf(132); // 65 bytes + 0x
    });

    it('should throw CriticalSecurityException if signing fails', async () => {
        // Invalid private key length
        const invalidKey = '0x123' as Hex;
        try {
            await client.signIntent(mockIntent, invalidKey);
            expect.fail('Should have thrown CriticalSecurityException');
        } catch (error: any) {
            expect(error.message).to.contain('Fail-Closed: RiskRouter signing failed');
        }
    });
});
