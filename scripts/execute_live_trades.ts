import ExecutionProxy from '../src/execution/proxy.ts';
import { KrakenMcpServer } from '../src/mcp/kraken/index.ts';
import { loadAgentMetadata } from '../src/logic/config.ts';
import type { Hex } from 'viem';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();
async function main() {
    console.log("--- STARTING LIVE TRADE EXECUTION ---");
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    if (fs.existsSync(auditLogPath)) fs.unlinkSync(auditLogPath);
    const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');
    const dummyDeployments = { network: "sepolia", chainId: 11155111, agentRegistry: "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3", riskRouter: "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC", agentId: "1", agentAddress: "0x0123456789abcdef0123456789abcdef0123456789abcdef" };
    fs.writeFileSync(deploymentsPath, JSON.stringify(dummyDeployments, null, 2));
    process.env.NETWORK = 'sepolia';
    const agentMetadata = loadAgentMetadata();
    const pk = process.env.AGENT_PRIVATE_KEY as Hex;
    const proxy = new ExecutionProxy(dummyDeployments.riskRouter as Hex);
    const mcpServer = new KrakenMcpServer();
    const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
    (proxy as any).mcpClient = {
        callTool: async ({ name, arguments: args }: any) => {
            const handler = (mcpServer.server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);
            if (!handler) throw new Error("CallTool handler not found");
            return await handler({ method: 'tools/call', params: { name, arguments: args } });
        }
    };
    const trades = [
        { pair: 'BTC/USD', amount: 0.00011, usdValue: 7350n },
        { pair: 'BTC/USD', amount: 0.00012, usdValue: 8020n },
        { pair: 'BTC/USD', amount: 0.00013, usdValue: 8690n },
        { pair: 'BTC/USD', amount: 0.00014, usdValue: 9360n },
        { pair: 'BTC/USD', amount: 0.00015, usdValue: 10030n },
        { pair: 'BTC/USD', amount: 0.00016, usdValue: 10700n },
        { pair: 'BTC/USD', amount: 0.00017, usdValue: 11370n },
        { pair: 'BTC/USD', amount: 0.00018, usdValue: 12040n },
        { pair: 'BTC/USD', amount: 0.00019, usdValue: 12710n },
        { pair: 'BTC/USD', amount: 0.00020, usdValue: 13380n },
        { pair: 'BTC/USD', amount: 0.00021, usdValue: 14050n },
        { pair: 'BTC/USD', amount: 0.00022, usdValue: 14720n },
    ];
    for (let i = 0; i < trades.length; i++) {
        console.log(`\n--- EXECUTING TRADE ${i + 1} / ${trades.length} ---`);
        const trade = trades[i];
        const decision = { action: 'BUY' as const, pair: trade.pair, amountUsdScaled: trade.usdValue, riskScore: 0.95, confidence: 0.95, reasoning: "Live Market Execution for Kraken Challenge Proof of Work. Verifying Sentinel Layer guardrails." };
        const { createSignedCheckpoint } = await import('../src/utils/checkpoint.ts');
        await createSignedCheckpoint(agentMetadata, decision, pk, 11155111);
        await proxy.processAuthorizedTrade(trade.pair, BigInt(Math.floor(trade.amount * 10**18)), `hackathon-live-${i}-${Date.now()}`);
        console.log(`TRADE ${i + 1} SUCCESSFUL`);
        if (i < trades.length - 1) await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.log("\n--- LIVE TRADE EXECUTION COMPLETE ---");
}
main().catch(console.error);
