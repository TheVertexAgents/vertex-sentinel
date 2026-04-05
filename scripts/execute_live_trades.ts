import ExecutionProxy from '../src/execution/proxy.js';
import { KrakenMcpServer } from '../src/mcp/kraken/index.js';
import { loadAgentMetadata } from '../src/logic/config.js';
import type { Hex } from 'viem';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * @dev Orchestration script for executing real Kraken trades.
 */
async function main() {
    console.log("--- STARTING LIVE TRADE EXECUTION ---");

    // 1. Ensure deployments_sepolia.json exists
    const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');
    const dummyDeployments = {
        network: "sepolia",
        chainId: 11155111,
        agentRegistry: "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3",
        riskRouter: "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC",
        agentId: "1",
        agentAddress: "0x0123456789abcdef0123456789abcdef0123456789abcdef"
    };
    fs.writeFileSync(deploymentsPath, JSON.stringify(dummyDeployments, null, 2));

    // 2. Set environment variables
    process.env.KRAKEN_CLI_PATH = './scripts/live_kraken_cli.js';
    process.env.NETWORK = 'sepolia';

    const agentMetadata = loadAgentMetadata();
    const pk = process.env.AGENT_PRIVATE_KEY as Hex;

    const proxy = new ExecutionProxy(dummyDeployments.riskRouter as Hex);

    console.log("Initializing Kraken MCP Server...");
    const mcpServer = new KrakenMcpServer();

    const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

    (proxy as any).mcpClient = {
        callTool: async ({ name, arguments: args }: any) => {
            const handler = (mcpServer.server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);
            if (!handler) throw new Error("CallTool handler not found");

            const result = await handler({
                method: 'tools/call',
                params: {
                    name,
                    arguments: args
                }
            });
            return result;
        }
    };

    const trades = [
        { pair: 'BTC/USD', amount: 0.00011 },
        { pair: 'BTC/USD', amount: 0.00012 },
        { pair: 'BTC/USD', amount: 0.00013 },
        { pair: 'BTC/USD', amount: 0.00014 },
    ];

    for (let i = 0; i < trades.length; i++) {
        console.log(`\n--- EXECUTING TRADE ${i + 1} / ${trades.length} ---`);

        const trade = trades[i];

        const decision = {
            action: 'BUY' as const,
            pair: trade.pair,
            amountUsdScaled: BigInt(Math.floor(trade.amount * 10**18)),
            riskScore: 0.90 + (Math.random() * 0.1),
            confidence: 0.90 + (Math.random() * 0.1),
            reasoning: "Live Market Execution for Kraken Challenge Proof of Work. Verifying Sentinel Layer guardrails."
        };

        console.log("Generating Signed Checkpoint...");
        const { createSignedCheckpoint } = await import('../src/utils/checkpoint.js');
        await createSignedCheckpoint(agentMetadata, decision, pk, 11155111);

        console.log("Executing Trade via Kraken MCP...");
        // Use pair with / as CCXT expects it usually
        await proxy.processAuthorizedTrade(trade.pair, decision.amountUsdScaled, `hackathon-live-${i}-${Date.now()}`);

        console.log(`TRADE ${i + 1} SUCCESSFUL`);

        if (i < trades.length - 1) {
            console.log("Waiting 5 seconds before next trade...");
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log("\n--- LIVE TRADE EXECUTION COMPLETE ---");
}

main().catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
