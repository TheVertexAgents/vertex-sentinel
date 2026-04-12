import ExecutionProxy from '../src/execution/proxy.js';
import { KrakenMcpServer } from '../src/mcp/kraken/index.js';
import { loadAgentMetadata } from '../src/logic/config.js';
import { analyzeRisk } from '../src/logic/strategy/risk_assessment.js';
import { createSignedCheckpoint } from '../src/utils/checkpoint.js';
import type { Hex } from 'viem';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function main() {
    console.log("================================================================");
    console.log("⚡ VERTEX SENTINEL: HIGH-CONCURRENCY STRESS TEST CYCLE ⚡");
    console.log("================================================================");

    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    if (fs.existsSync(auditLogPath)) fs.unlinkSync(auditLogPath);
    
    // We mock deployments for local stress test to bypass Sepolia restrictions.
    process.env.NETWORK = 'local';
    
    const agentMetadata = loadAgentMetadata();
    const pk = process.env.AGENT_PRIVATE_KEY as Hex;
    if (!pk) throw new Error("AGENT_PRIVATE_KEY missing");

    const proxy = new ExecutionProxy('0x0000000000000000000000000000000000000000', 'local');
    const mcpServer = new KrakenMcpServer();
    
    const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
    (proxy as any).mcpClient = {
        callTool: async ({ name, arguments: args }: any) => {
            const handler = (mcpServer.server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);
            if (!handler) throw new Error("CallTool handler not found");
            return await handler({ method: 'tools/call', params: { name, arguments: args } });
        }
    };
    
    // Target pairs for concurrent load test
    const pairsToTrade = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'LINK/USD', 'UNI/USD'];
    const volumeUsdScaled = 1000n; // ~ $10.00 each

    console.log(`\\n[1/3] Triggering Concurrent Brain Evaluations (${pairsToTrade.length} pairs)...`);
    console.log(`      Expect GenAI 503 Throttling & Degraded Mode Catching!`);

    const startAnalysis = Date.now();
    const assessments = await Promise.allSettled(
        pairsToTrade.map(pair => analyzeRisk(pair, volumeUsdScaled))
    );
    const endAnalysis = Date.now();
    
    console.log(`\\n[+] Analysis Phase Complete in ${((endAnalysis - startAnalysis)/1000).toFixed(2)}s`);
    
    const authorizedDecisions: any[] = [];
    
    assessments.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
            console.log(`    ✅ ${pairsToTrade[idx]} processed successfully -> Risk Score: ${result.value.riskScore}`);
            authorizedDecisions.push(result.value);
        } else {
            console.log(`    ❌ ${pairsToTrade[idx]} FAILED UNEXPECTEDLY -> ${result.reason}`);
        }
    });

    console.log(`\\n[2/3] Cryptographically Signing Intents & Submitting to Sentinel...`);
    await Promise.all(
        authorizedDecisions.map(decision => createSignedCheckpoint(agentMetadata, decision, pk, 31337))
    );
    
    console.log(`\\n[3/3] Concurrent Execution Proxy Dispatches (Execution layer load test)...`);
    const startExecution = Date.now();
    
    await Promise.allSettled(
        authorizedDecisions.map((decision, idx) => {
            const traceId = `STRESS-TEST-${Date.now()}-${idx}`;
            // If the riskScore is too high, it sets amount to 0n, which Kraken will reject or bypass.
            return proxy.processAuthorizedTrade(decision.pair, decision.amountUsdScaled, traceId);
        })
    );
    
    const endExecution = Date.now();
    console.log(`\\n[+] Execution Phase Complete in ${((endExecution - startExecution)/1000).toFixed(2)}s\\n`);

    if (fs.existsSync(auditLogPath)) {
        console.log("--- FINAL AUDIT LOG SNAPSHOT ---");
        const auditLines = fs.readFileSync(auditLogPath, 'utf8').trim().split('\\n');
        auditLines.forEach(line => {
            if (line) {
                const j = JSON.parse(line);
                console.log(`[AUDIT] Trace: ${j.traceId} | Pair: ${j.pair} | Status: ${j.krakenStatus}`);
            }
        });
    }

    console.log("\\n================================================================");
    console.log("🏁 STRESS TEST COMPLETE 🏁");
    console.log("================================================================");
}

main().catch(console.error);
