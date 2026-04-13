import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { CriticalSecurityException } from '../errors.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import type { Ticker, Balance, TradeHistory } from '../../mcp/kraken/types.js';

/**
 * @dev Strategy Output Schema.
 * Enhanced to meet Milestone 2 requirements for Intelligent Verifiability.
 */
export const TradeDecisionSchema = z.object({
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  pair: z.string(),
  amountUsdScaled: z.bigint(),
  confidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(1),
  reasoning: z.string(),
  breakdown: z.object({
    marketRisk: z.number(),
    portfolioRisk: z.number(),
    sentimentRisk: z.number(),
    manualPenalty: z.number(),
    aiScore: z.number(),
  }),
  marketData: z.object({
    spread: z.number(),
    volatility: z.number(),
  }).optional(),
});

export type TradeDecision = z.infer<typeof TradeDecisionSchema>;

// Initialize Genkit
const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })],
});

/**
 * @dev Simple MCP Client Singleton for Ticker and Account Data.
 */
let mcpClient: Client | null = null;
let isConnecting = false;
let connectionFailed = false;

export async function getMcpClient() {
  if (mcpClient) return mcpClient;
  if (connectionFailed) throw new Error('MCP connection previously failed');
  if (isConnecting) throw new Error('MCP connection already in progress');

  isConnecting = true;
  console.log('[MCP_INITIALIZE] Connecting to Kraken MCP server...');

  try {
    const serverPath = path.join(process.cwd(), 'src/mcp/kraken/index.ts');
    console.log(`[MCP_INITIALIZE] Spawning MCP server from: ${serverPath}`);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', '--no-warnings', serverPath],
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

    await Promise.race([
      mcpClient.connect(transport),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MCP connection timeout')), 15000))
    ]);

    isConnecting = false;
    console.log('[MCP_INITIALIZE] Connected successfully');
    return mcpClient;
  } catch (err: any) {
    isConnecting = false;
    connectionFailed = true;
    console.warn(`[MCP_INITIALIZE] Connection failed: ${err.message}`);
    throw err;
  }
}

/**
 * @dev Safely calls an MCP tool and parses the response.
 */
async function callMcpTool(name: string, args: Record<string, any> = {}) {
  const client = await getMcpClient();
  const response = await client.callTool({ name, arguments: args }) as { 
    isError?: boolean; 
    content: Array<{ type: string; text: string }> 
  };

  if (response.isError) {
    throw new Error(response.content[0].text);
  }

  try {
    return JSON.parse(response.content[0].text);
  } catch (err) {
    throw new Error(`Invalid JSON response from ${name}: ${response.content[0].text}`);
  }
}

/**
 * @dev Closes the MCP client and cleans up transport resources.
 */
export async function closeMcpClient() {
  if (mcpClient) {
    console.log('[MCP_CLIENT] Closing connection...');
    try {
      await mcpClient.close();
    } catch (err: any) {
      console.warn(`[MCP_CLIENT] Error closing client: ${err.message}`);
    }
    mcpClient = null;
  }
}

/**
 * @dev Live AI Sentiment API (Genkit)
 */
async function getSentiment(pair: string) {
  try {
    const aiResponse = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      prompt: `Analyze the current real-world market sentiment for ${pair} crypto asset. Output JSON with headline, indicator (Bullish/Bearish/Neutral), and score (0.0 to 1.0).`,
      output: {
        format: 'json',
        schema: z.object({
          headline: z.string(),
          indicator: z.string(),
          score: z.number().min(0).max(1)
        })
      }
    });

    if (aiResponse.output) {
      console.log(`[SENTIMENT] Successfully fetched live sentiment for ${pair}`);
      return aiResponse.output;
    }
  } catch (err: any) {
    if (err.message?.includes('UNAVAILABLE') || err.message?.includes('503')) {
      console.warn(`[SENTIMENT] Service unavailable. Entering degraded mode for sentiment.`);
    } else {
      console.warn(`[SENTIMENT] Live sentiment API unreachable. Degraded mode active.`);
    }
  }

  // Degraded Mode Fallback
  return {
    headline: `Live sentiment unavailable for ${pair}. Relying strictly on market volatility metrics.`,
    indicator: "Neutral",
    score: 0.5
  };
}

/**
 * @dev Core Risk Assessment Strategy Logic.
 * Integrates Genkit AI reasoning with a manual bootstrap penalty model.
 */
export async function analyzeRisk(pair: string, amountUsdScaled: bigint): Promise<TradeDecision> {
  console.log(`[RISK_STRATEGY] Starting analysis for ${pair}...`);
  try {
    const client = await getMcpClient();

    // 1. Fetch Market Data
    const ticker = await callMcpTool('get_ticker', { symbol: pair }) as Ticker;

    // 2. Fetch Portfolio & History
    const balance = await callMcpTool('get_balance', {}) as Balance;
    const history = await callMcpTool('get_trade_history', {}) as TradeHistory;
    const sentiment = await getSentiment(pair);

    // 3. Manual Penalty Model (Bootstrap Logic)
    const ask = parseFloat(ticker.a[0]);
    const bid = parseFloat(ticker.b[0]);
    const spread = (ask - bid) / ask;
    const high24h = parseFloat(ticker.h[1]);
    const low24h = parseFloat(ticker.l[1]);
    const volatility = (high24h - low24h) / low24h;

    const spreadPenalty = Math.min(0.5, (spread / 0.02) * 0.5);
    const volatilityPenalty = Math.min(0.3, (volatility / 0.1) * 0.3);
    const volumePenalty = Math.min(0.2, (Number(amountUsdScaled) / 100000) * 0.2);
    const manualPenalty = Math.min(1.0, spreadPenalty + volatilityPenalty + volumePenalty);

    // 4. Genkit AI Risk Assessment
    const amountUsd = Number(amountUsdScaled) / 100;

    let aiResult = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        const aiResponse = await ai.generate({
          model: googleAI.model('gemini-flash-latest'),
          prompt: `You are the Vertex Sentinel Risk Specialist. Your mandate is to protect the agent's capital by identifying high-risk trade intents before they reach the blockchain.

Analyze the provided data and evaluate:
1. Market Risk: Based on Bid/Ask spread and volatility.
2. Portfolio Impact: Sizing of the trade relative to total allocation.
3. Historical Correlation: Is this strategy repeating past failures?
4. Sentiment Risk: Adverse news or indicators.

Trade Intent:
- Pair: ${pair}
- Amount: $${amountUsd.toFixed(2)}

Market Data:
${JSON.stringify(ticker, null, 2)}

Portfolio Balance:
${JSON.stringify(balance, null, 2)}

Recent History (last ${history.count} trades):
${JSON.stringify(history.trades, null, 2)}

Sentiment:
"${sentiment.headline}" (${sentiment.indicator})

Output your response in valid JSON format:
{
  "riskScore": number (0.0 to 1.0),
  "marketRisk": number (0.0 to 1.0),
  "portfolioRisk": number (0.0 to 1.0),
  "sentimentRisk": number (0.0 to 1.0),
  "justification": "concise string"
}`,
          output: {
            format: 'json',
            schema: z.object({
              riskScore: z.number(),
              marketRisk: z.number(),
              portfolioRisk: z.number(),
              sentimentRisk: z.number(),
              justification: z.string(),
            })
          }
        });
        aiResult = aiResponse.output;
        break; // Success, exit retry loop
      } catch (err: any) {
        attempts++;
        if (err.message?.includes('UNAVAILABLE') || err.message?.includes('503')) {
          console.warn(`[AI_RISK] 503 Error on attempt ${attempts}. Retrying...`);
          await new Promise(r => setTimeout(r, attempts * 1000));
        } else {
          console.warn(`[AI_RISK] API failed: ${err.message}`);
          break; // Don't retry on other errors
        }
      }
    }

    if (!aiResult) {
      console.warn("[AI_RISK] All AI attempts failed. Entering DEGRADED MODE (relying strictly on market data).");
      aiResult = {
        riskScore: 0, // Fallback to solely relying on manualPenalty
        marketRisk: 0,
        portfolioRisk: 0,
        sentimentRisk: 0,
        justification: "Degraded Mode: Hardware rules override. API Unavailable.",
      };
    }

    // 5. Hybrid Enforcement (Fail-Closed)
    // If either manual penalty or AI score exceeds 0.8, we HOLD.
    const riskScore = Math.max(manualPenalty, aiResult.riskScore);
    const confidence = 1.0 - riskScore;
    const confidenceThreshold = 0.2; // Equivalent to risk 0.8

    let action: 'BUY' | 'SELL' | 'HOLD' = 'BUY';
    let reasons = [aiResult.justification];

    if (manualPenalty > 0.8) reasons.push(`Critical Manual Penalty: ${(manualPenalty * 100).toFixed(0)}%`);
    if (aiResult.riskScore > 0.8) reasons.push(`Critical AI Risk Score: ${(aiResult.riskScore * 100).toFixed(0)}%`);
    if (confidence < confidenceThreshold) {
      action = 'HOLD';
      reasons.push("Fail-Closed: Risk threshold exceeded.");
    }

    return {
      action,
      pair,
      amountUsdScaled: action === 'HOLD' ? 0n : amountUsdScaled,
      confidence,
      riskScore,
      reasoning: reasons.join(" | "),
      breakdown: {
        marketRisk: aiResult.marketRisk,
        portfolioRisk: aiResult.portfolioRisk,
        sentimentRisk: aiResult.sentimentRisk,
        manualPenalty,
        aiScore: aiResult.riskScore
      },
      marketData: { spread, volatility }
    };

  } catch (error) {
    if (error instanceof CriticalSecurityException) throw error;

    if (process.env.NETWORK !== 'sepolia') {
      console.warn(`[risk_assessment] Risk assessment failed in local mode, using fallback. Error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        action: 'HOLD',
        pair,
        amountUsdScaled: 0n,
        confidence: 0,
        riskScore: 1.0,
        reasoning: 'Fallback: AI/MCP Engine unavailable in local mode',
        breakdown: { marketRisk: 0, portfolioRisk: 0, sentimentRisk: 0, manualPenalty: 0, aiScore: 1.0 }
      };
    }

    throw new CriticalSecurityException(`Risk assessment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
