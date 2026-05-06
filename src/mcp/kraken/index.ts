import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { kraken as KrakenExchange } from 'ccxt';
import {
  TickerSchema,
  OrderParamsSchema,
  OrderResultSchema,
} from './types.js';
import { validateEnv } from '../../logic/env.js';
import { CriticalSecurityException } from '../../logic/errors.js';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger.js';

/**
 * @title Kraken MCP Server
 * @dev Standardized MCP server for Kraken exchange interactions via CCXT.
 * Decouples execution logic from the Sentinel Layer.
 * Strictly adheres to Project Constitution v2.0.0.
 *
 * Paper Mode (KRAKEN_PAPER_MODE=true):
 *   Ticker:       Real market data
 *   Balance:      Mock balance
 *   History:      Mock history
 *   Order Buy:    Simulated buy
 *   Order Sell:   Simulated sell
 */
export class KrakenMcpServer {
  public server: Server; // Made public for testing
  private apiKey: string;
  private apiSecret: string;
  private exchange: KrakenExchange;

  constructor() {
    // Validate Environment first (Fail-Closed)
    const env = validateEnv();
    this.apiKey = env.KRAKEN_API_KEY;
    this.apiSecret = env.KRAKEN_SECRET;

    // Initialize CCXT Kraken client (#144)
    this.exchange = new KrakenExchange({
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      // Kraken requires increasing nonces. Microseconds are standard.
      nonce: () => Date.now() * 1000
    });

    this.server = new Server(
      {
        name: 'kraken-mcp-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    
    this.server.onerror = (error) => {
      this.log('mcp_error', { error: error.message });
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * @dev Retry wrapper for CCXT calls with exponential backoff.
   */
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 1; i <= attempts; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const isRetryable = error.message?.includes('ETIMEDOUT') ||
                          error.message?.includes('502') ||
                          error.message?.includes('503') ||
                          error.name === 'RequestTimeout' ||
                          error.name === 'ExchangeNotAvailable';

        if (i < attempts && isRetryable) {
          const delay = Math.pow(2, i) * 1000;
          this.log('retry', { attempt: i, delay, error: error.message });
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retry attempts reached');
  }

  /**
   * @dev Structured JSON logging to stderr as mandated by Constitution v2.0.0.
   */
  private log(event: string, data: Record<string, unknown>) {
    logger.error({
      event,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * @dev Returns true if KRAKEN_PAPER_MODE environment variable is set to 'true'.
   */
  private isPaperMode(): boolean {
    return process.env.KRAKEN_PAPER_MODE === 'true';
  }

  /**
   * @dev Creates a standardized MCP error response.
   * Instead of crashing the Node process, this returns an error object
   * that the LLM reasoning engine can interpret and decide to retry.
   */
  private mcpErrorResponse(message: string): { isError: true; content: Array<{ type: string; text: string }> } {
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
    };
  }

  private setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_ticker',
          description: 'Fetch current price for a trading pair (e.g., BTC/USD)',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
            },
            required: ['symbol'],
          },
        },
        {
          name: 'get_balance',
          description: 'Fetch account balance for all assets',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_trade_history',
          description: 'Fetch recent trade history',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'place_order',
          description: 'Place a market or limit order on Kraken',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              side: { type: 'string', enum: ['buy', 'sell'] },
              type: { type: 'string', enum: ['market', 'limit'] },
              amount: { type: 'number' },
              price: { type: 'number' },
            },
            required: ['symbol', 'side', 'type', 'amount'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;

      try {
        switch (toolName) {
          case 'get_ticker': {
            const args = request.params.arguments as { symbol: string };
            const { symbol } = args;
            
            this.log('tool_call', { tool: toolName, symbol });

            // Migrated to CCXT with Retry and Timeout (#148)
            const ticker = await this.withRetry(() =>
              this.exchange.fetchTicker(symbol, { 'timeout': 10000 })
            );

            const validated = TickerSchema.parse({
                symbol: symbol,
                a: [ticker.ask?.toString() || '0', '0', '0'],
                b: [ticker.bid?.toString() || '0', '0', '0'],
                c: [ticker.last?.toString() || '0', '0'],
                v: [ticker.baseVolume?.toString() || '0', ticker.baseVolume?.toString() || '0'],
                p: [ticker.vwap?.toString() || '0', ticker.vwap?.toString() || '0'],
                t: [Number((ticker as any).count || 0), Number((ticker as any).count || 0)],
                l: [ticker.low?.toString() || '0', ticker.low?.toString() || '0'],
                h: [ticker.high?.toString() || '0', ticker.high?.toString() || '0'],
                o: ticker.open?.toString() || '0'
            });

            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          case 'get_balance': {
            this.log('tool_call', { tool: toolName });
            
            if (this.isPaperMode()) {
                // Institutional-grade mock balance for Paper Mode (#144)
                const mockBalance = {
                    "USDC": "100000.00",
                    "BTC": "2.50",
                    "ETH": "25.00",
                    "SOL": "500.00"
                };
                return {
                    content: [{ type: 'text', text: JSON.stringify(mockBalance) }],
                };
            }

            const balance = await this.exchange.fetchBalance();

            let normalizedBalance: Record<string, string> = {};
            for (const [asset, info] of Object.entries(balance.total)) {
              if (info !== undefined && info !== null && Number(info) > 0) {
                normalizedBalance[asset] = info.toString();
              }
            }

            return {
              content: [{ type: 'text', text: JSON.stringify(normalizedBalance) }],
            };
          }

          case 'get_trade_history': {
            this.log('tool_call', { tool: toolName });

            if (this.isPaperMode()) {
                return {
                    content: [{ type: 'text', text: JSON.stringify({ trades: {}, count: 0 }) }],
                };
            }

            const trades = await this.exchange.fetchMyTrades();

            let tradesRecord: Record<string, Record<string, unknown>> = {};
            for (const trade of trades) {
              const id = trade.id || `t-${Date.now()}`;
              tradesRecord[id] = {
                ordertxid: trade.order,
                pair: trade.symbol,
                time: (trade.timestamp || Date.now()) / 1000,
                type: trade.side,
                ordertype: trade.type,
                price: trade.price?.toString() || '0',
                cost: trade.cost?.toString() || '0',
                fee: trade.fee?.cost?.toString() || '0',
                vol: trade.amount?.toString() || '0',
              };
            }

            const normalizedHistory = {
              trades: tradesRecord,
              count: trades.length,
            };

            return {
              content: [{ type: 'text', text: JSON.stringify(normalizedHistory) }],
            };
          }

          case 'place_order': {
            const params = OrderParamsSchema.parse(request.params.arguments);
            this.log('tool_call', { tool: toolName, params: params as unknown as Record<string, unknown> });

            if (this.isPaperMode()) {
                // Simulated execution for Paper Mode (#144)
                return {
                    content: [{ type: 'text', text: JSON.stringify({
                        action: params.side,
                        order_id: `PAPER-${Date.now()}`,
                        pair: params.symbol,
                        price: params.price || 0, // In market mode, price might be 0
                        volume: params.amount,
                        cost: (params.price || 0) * params.amount
                    }) }],
                };
            }

            const order = await this.withRetry(() =>
              this.exchange.createOrder(
                params.symbol,
                params.type,
                params.side,
                params.amount,
                params.price,
                { 'timeout': 10000 }
              )
            );

            const validated = OrderResultSchema.parse({
              descr: { order: `${params.side} ${params.amount} ${params.symbol} @ ${params.type}` },
              txid: [order.id]
            });

            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${toolName}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log('tool_error', { tool: toolName, error: errorMessage });

        if (error instanceof ZodError) {
          throw new McpError(ErrorCode.InvalidParams, `Validation error: ${errorMessage}`);
        }

        // According to Constitution v2.0.0: Fail-Closed on order execution security errors
        if (toolName === 'place_order') {
          throw new CriticalSecurityException(`Execution failure on Kraken API: ${errorMessage}`);
        }

        // For all other tools (read-only): return MCP error response so the LLM
        // can see rate-limit / network errors and decide to retry gracefully.
        return this.mcpErrorResponse(`Exchange error: ${errorMessage}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log('server_start', {
      message: 'Kraken MCP server running on stdio',
      paperMode: this.isPaperMode(),
      version: '2.0.0',
    });
  }
}

// Entry point only if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const server = new KrakenMcpServer();
    server.run().catch((error: Error) => {
      logger.error({
        event: 'runtime_error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });
  } catch (error: any) {
    logger.error({
      event: 'initialization_error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}
