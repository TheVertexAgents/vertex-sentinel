import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { spawnSync } from 'child_process';
import {
  TickerSchema,
  BalanceSchema,
  OrderParamsSchema,
  OrderResultSchema,
  TradeHistorySchema,
} from './types.js';
import { validateEnv } from '../../logic/env.js';
import { CriticalSecurityException } from '../../logic/errors.js';
import { ZodError } from 'zod';

/**
 * @title Kraken MCP Server
 * @dev Standardized MCP server for Kraken exchange interactions via Kraken CLI.
 * Decouples execution logic from the Sentinel Layer.
 * Strictly adheres to Project Constitution v2.0.0.
 */
export class KrakenMcpServer {
  public server: Server; // Made public for testing
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    // Validate Environment first (Fail-Closed)
    const env = validateEnv();
    this.apiKey = env.KRAKEN_API_KEY;
    this.apiSecret = env.KRAKEN_SECRET;

    this.server = new Server(
      {
        name: 'kraken-mcp-server',
        version: '1.0.0',
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
   * @dev Structured JSON logging to stderr as mandated by Constitution v2.0.0.
   */
  private log(event: string, data: Record<string, unknown>) {
    console.error(JSON.stringify({
      event,
      ...data,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * @dev Executes a command using the Kraken CLI.
   * Implements "Fail-Closed" principle.
   * Uses spawnSync with argument array to prevent command injection.
   */
  private executeKrakenCli(command: string, args: string[]): unknown {
    const krakenPath = process.env.KRAKEN_CLI_PATH || 'kraken';

    const finalArgs = [command, ...args, '-o', 'json'];

    const result = spawnSync(krakenPath, finalArgs, {
        env: {
            ...process.env,
            KRAKEN_API_KEY: this.apiKey,
            KRAKEN_API_SECRET: this.apiSecret
        },
        stdio: ['inherit', 'pipe', 'pipe'],
        encoding: 'utf-8'
    });

    if (result.error) {
        throw new Error(`Failed to execute Kraken CLI: ${result.error.message}`);
    }

    if (!result.stdout) {
        throw new Error(`Kraken CLI returned no output. Stderr: ${result.stderr}`);
    }

    try {
      const parsed = JSON.parse(result.stdout);

      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        throw new Error(`Kraken CLI Error (${parsed.error}): ${parsed.message}`);
      }

      return parsed;
    } catch (error: unknown) {
      if (error instanceof Error) {
          throw error;
      }
      throw new Error(`Failed to parse Kraken CLI output: ${String(error)}`);
    }
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

            const cleanSymbol = symbol.replace('/', '');
            const result = this.executeKrakenCli('ticker', [cleanSymbol]);

            if (!result || typeof result !== 'object') {
                throw new Error('Invalid ticker response from CLI');
            }

            const pairKey = Object.keys(result)[0];
            const tickerData = (result as Record<string, unknown>)[pairKey];
            
            if (!tickerData || typeof tickerData !== 'object') {
                throw new Error(`Ticker data not found for ${pairKey}`);
            }

            const validated = TickerSchema.parse({
                symbol: pairKey,
                ...tickerData
            });

            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          case 'get_balance': {
            this.log('tool_call', { tool: toolName });
            
            const result = this.executeKrakenCli('balance', []);
            const validated = BalanceSchema.parse(result);

            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          case 'get_trade_history': {
            this.log('tool_call', { tool: toolName });

            const result = this.executeKrakenCli('trades', []);
            const validated = TradeHistorySchema.parse(result);

            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          case 'place_order': {
            const params = OrderParamsSchema.parse(request.params.arguments);
            this.log('tool_call', { tool: toolName, params: params as unknown as Record<string, unknown> });

            const cliArgs = [
                params.side,
                params.symbol.replace('/', ''),
                params.amount.toString(),
                '--type', params.type
            ];
            
            if (params.price) {
                cliArgs.push('--price', params.price.toString());
            }

            const result = this.executeKrakenCli('order', cliArgs);
            const validated = OrderResultSchema.parse(result);

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

        // According to Constitution v2.0.0: Fail-Closed on sensitive errors
        if (toolName === 'place_order') {
          throw new CriticalSecurityException(`Execution failure on Kraken CLI: ${errorMessage}`);
        }

        throw new McpError(ErrorCode.InternalError, `Exchange error: ${errorMessage}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log('server_start', { message: 'Kraken MCP server running on stdio (CLI mode)' });
  }
}

// Entry point only if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new KrakenMcpServer();
  server.run().catch((error: Error) => {
    console.error(JSON.stringify({
      event: 'startup_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    process.exit(1);
  });
}
