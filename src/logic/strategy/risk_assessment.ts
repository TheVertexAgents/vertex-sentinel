import { z } from 'genkit';
import { CriticalSecurityException } from '../errors.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @dev Strategy Output Schema.
 */
export const TradeDecisionSchema = z.object({
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  pair: z.string(),
  amountUsdScaled: z.bigint(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  riskScore: z.number().optional(),
  marketData: z.any().optional(),
});

export type TradeDecision = z.infer<typeof TradeDecisionSchema>;

/**
 * @dev Simple MCP Client Singleton for Ticker Data.
 */
let mcpClient: Client | null = null;

async function getMcpClient() {
  if (mcpClient) return mcpClient;

  // Paths are relative to the final compiled location or ts-node context
  const serverPath = path.join(process.cwd(), 'src/mcp/kraken/index.ts');
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['--loader', 'ts-node/esm', '--no-warnings', serverPath],
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
      KRAKEN_CLI_PATH: process.env.KRAKEN_CLI_PATH || 'kraken'
    } as Record<string, string>
  });

  mcpClient = new Client(
    { name: 'sentinel-strategy-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);
  return mcpClient;
}

/**
 * @dev Core Risk Assessment Strategy Logic.
 * Decoupled from the agent's brain for better testability and modularity.
 */
export async function analyzeRisk(pair: string, amountUsdScaled: bigint): Promise<TradeDecision> {
  try {
    const client = await getMcpClient();
    const tickerResponse = await client.callTool({
      name: 'get_ticker',
      arguments: { symbol: pair }
    }) as any;

    if (!tickerResponse || !tickerResponse.content || !tickerResponse.content[0]) {
      throw new CriticalSecurityException(`Kraken API unreachable or returned empty response for ${pair}`);
    }

    const ticker = JSON.parse(tickerResponse.content[0].text);

    // Spread calculation: (ask - bid) / ask
    const ask = parseFloat(ticker.a[0]);
    const bid = parseFloat(ticker.b[0]);
    const spread = (ask - bid) / ask;

    // Volatility calculation: (24h_high - 24h_low) / 24h_low
    const high24h = parseFloat(ticker.h[1]);
    const low24h = parseFloat(ticker.l[1]);
    const volatility = (high24h - low24h) / low24h;

    let riskScore = 0.1;
    let reasons = [];

    if (spread > 0.015) {
      riskScore = 0.9;
      reasons.push(`High spread detected: ${(spread * 100).toFixed(2)}%`);
    }

    if (volatility > 0.05) {
      riskScore = 0.9;
      reasons.push(`High volatility detected: ${(volatility * 100).toFixed(2)}%`);
    }

    if (amountUsdScaled > 50000n) { // $500 * 100
      riskScore = Math.max(riskScore, 0.9);
      reasons.push("High volume detected");
    }

    const isHighRisk = riskScore > 0.8;
    const action = isHighRisk ? 'HOLD' : 'BUY'; // Simple demo: BUY if safe, else HOLD
    const confidence = isHighRisk ? 0.95 : 0.85;

    return {
      action,
      pair,
      amountUsdScaled: isHighRisk ? 0n : amountUsdScaled,
      confidence,
      reasoning: reasons.length > 0 ? reasons.join(", ") : "Standard trade parameters",
      riskScore,
      marketData: { spread, volatility }
    };

  } catch (error) {
    if (error instanceof CriticalSecurityException) throw error;
    throw new CriticalSecurityException(`Risk assessment failed due to external error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
