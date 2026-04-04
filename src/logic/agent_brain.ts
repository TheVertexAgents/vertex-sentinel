import { createWalletClient, http, parseEther } from 'viem';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import type { TradeIntent, Authorization } from './types.js';
import dotenv from 'dotenv';
import { validateEnv } from './env.js';
import { CriticalSecurityException } from './errors.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

// Validate environment on startup if not in test
if (process.env.NODE_ENV !== 'test') {
    validateEnv();
}

/**
 * @dev Loads the deployment configuration for the current environment.
 */
function getDeploymentConfig() {
  const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');

  if (process.env.NETWORK === 'sepolia') {
    if (!fs.existsSync(deploymentsPath)) {
      throw new CriticalSecurityException('Fail-Closed: deployments_sepolia.json is missing but NETWORK is set to sepolia');
    }
    try {
      return JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    } catch (error) {
      throw new CriticalSecurityException(`Fail-Closed: Failed to parse deployments_sepolia.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Default to Local Hardhat if not explicitly set to sepolia
  return {
    chainId: 31337, // Hardhat default
    riskRouter: '0x0000000000000000000000000000000000000000' // Placeholder for local
  };
}

const config = getDeploymentConfig();

// EIP-712 Domain definition matching RiskRouter.sol
const domain = {
  name: 'RiskRouter',
  version: '1',
  chainId: config.chainId || 11155111,
  verifyingContract: config.riskRouter as `0x${string}`,
} as const;

const types = {
  TradeIntent: [
    { name: 'agentId', type: 'uint256' },
    { name: 'agentWallet', type: 'address' },
    { name: 'pair', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'amountUsdScaled', type: 'uint256' },
    { name: 'maxSlippageBps', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/**
 * @dev Helper to get a unique trace ID.
 */
function getTraceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * @dev Mock "Strykr PRISM API" for canonical asset resolution.
 */
async function getAssetResolution(pair: string) {
  console.log(JSON.stringify({
    level: "INFO",
    module: "PRISM",
    message: `Resolving canonical metadata for ${pair}...`,
    timestamp: new Date().toISOString()
  }));
  return { symbol: pair, precision: 18 };
}

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});

let mcpClient: Client | null = null;

async function getMcpClient() {
  if (mcpClient) return mcpClient;

  const serverPath = path.join(__dirname, '../mcp/kraken/index.ts');
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
    { name: 'sentinel-brain-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);
  return mcpClient;
}

/**
 * @dev Genkit flow for verifiable risk assessment.
 */
const riskScoreFlow = ai.defineFlow(
  {
    name: 'riskScoreFlow',
    inputSchema: z.object({
      pair: z.string(),
      amountUsdScaled: z.string(),
      traceId: z.string(),
    }),
    outputSchema: z.object({
      score: z.number(),
      reason: z.string(),
      marketData: z.any().optional(),
    }),
  },
  async (input) => {
    console.error(JSON.stringify({
        level: "INFO",
        module: "Genkit",
        TRACE_ID: input.traceId,
        message: `Running risk assessment for ${input.pair} trade...`,
        timestamp: new Date().toISOString()
    }));

    try {
        const client = await getMcpClient();
        const tickerResponse = await client.callTool({
            name: 'get_ticker',
            arguments: { symbol: input.pair }
        }) as any;

        if (!tickerResponse || !tickerResponse.content || !tickerResponse.content[0]) {
            throw new CriticalSecurityException(`Kraken API unreachable or returned empty response for ${input.pair}`);
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

        let score = 0.1;
        let reasons = [];

        if (spread > 0.015) {
            score = 0.9;
            reasons.push(`High spread detected: ${(spread * 100).toFixed(2)}%`);
        }

        if (volatility > 0.05) {
            score = 0.9;
            reasons.push(`High volatility detected: ${(volatility * 100).toFixed(2)}%`);
        }

        if (parseInt(input.amountUsdScaled) > 50000) { // $500 * 100
            score = Math.max(score, 0.9);
            reasons.push("High volume detected");
        }

        return {
            score,
            reason: reasons.length > 0 ? reasons.join(", ") : "Standard trade parameters",
            marketData: { spread, volatility }
        };

    } catch (error) {
        if (error instanceof CriticalSecurityException) throw error;
        throw new CriticalSecurityException(`Risk assessment failed due to external error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * @dev The Intent Layer creates a signed TradeIntent.
 */
async function signIntent(intent: TradeIntent, privateKey: Hex): Promise<Authorization> {
  const traceId = getTraceId();
  try {
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    });

    // Run Genkit Risk Assessment
    const risk = await riskScoreFlow({
      pair: intent.pair,
      amountUsdScaled: intent.amountUsdScaled.toString(),
      traceId
    });

    // Fail-Closed Principle: Ensure risk output is valid
    if (!risk || risk.score === undefined) {
      throw new CriticalSecurityException(`Invalid risk assessment output for ${intent.pair}`);
    }

    console.error(JSON.stringify({
      level: "INFO",
      step: "RISK_ASSESSMENT",
      TRACE_ID: traceId,
      pair: intent.pair,
      score: risk.score,
      reason: risk.reason,
      timestamp: new Date().toISOString()
    }));

    if (risk.score > 0.8) {
       return { isAllowed: false, reason: `Risk too high: ${risk.reason}`, signature: '0x' };
    }

    console.error(JSON.stringify({
      level: "INFO",
      step: "SIGNING_INTENT",
      TRACE_ID: traceId,
      pair: intent.pair,
      agentId: intent.agentId.toString(),
      timestamp: new Date().toISOString()
    }));

    // Sign the intent using EIP-712
    const signature = await client.signTypedData({
      domain,
      types,
      primaryType: 'TradeIntent',
      message: intent,
    });

    return { isAllowed: true, reason: risk.reason, signature };
  } catch (error) {
    if (error instanceof CriticalSecurityException) {
      throw error;
    }
    throw new CriticalSecurityException(`Critical error during signIntent: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Logic loop demo
async function main() {
  console.log(JSON.stringify({
    level: "INFO",
    message: "VertexAgents Sentinel Brain Initialization..."
  }));

  // Demo Intent
  const demoIntent: TradeIntent = {
    agentId: 1n,
    agentWallet: '0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9',
    pair: 'BTC/USDC',
    action: 'BUY',
    amountUsdScaled: 10000n, // $100.00
    maxSlippageBps: 100n,
    nonce: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  };

  // Use a dummy private key if one is not provided in .env
  const pk = (process.env.AGENT_PRIVATE_KEY as Hex) || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  const auth = await signIntent(demoIntent, pk);
  console.log("--- AUTHORIZATION ARTIFACT ---");
  console.log(JSON.stringify(auth, null, 2));
  console.log("--- END ---");
}

if (import.meta.url === `file://${fileURLToPath(import.meta.url)}` || (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))) {
  main().catch((error) => {
    console.error(JSON.stringify({
      level: "CRITICAL",
      exception: "CriticalSecurityException",
      message: error.message,
      stack: error.stack
    }));
    process.exit(1);
  });
}

export { signIntent, getAssetResolution };
