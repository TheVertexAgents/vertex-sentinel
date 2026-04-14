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
import { logger } from '../../utils/logger.js';

/**
 * @title Kraken MCP Server
 * @dev Standardized MCP server for Kraken exchange interactions via the official
 * Kraken Rust CLI binary. Decouples execution logic from the Sentinel Layer.
 * Strictly adheres to Project Constitution v2.0.0.
 *
 * CLI Syntax (2026 Kraken CLI):
 *   Global JSON:  kraken -o json <command> [args...]
 *   Ticker:       kraken -o json ticker <PAIR>
 *   Balance:      kraken -o json balance
 *   History:      kraken -o json trades-history
 *   Order Buy:    kraken -o json order buy <PAIR> <VOLUME> --type <TYPE> [--price <PRICE>]
 *   Order Sell:   kraken -o json order sell <PAIR> <VOLUME> --type <TYPE> [--price <PRICE>]
 *
 * Paper Mode (KRAKEN_PAPER_MODE=true):
 *   Ticker:       kraken -o json ticker <PAIR>          (always real market data)
 *   Balance:      kraken -o json paper balance
 *   History:      kraken -o json paper history
 *   Order Buy:    kraken -o json paper buy <PAIR> <VOLUME> --type <TYPE> [--price <PRICE>]
 *   Order Sell:   kraken -o json paper sell <PAIR> <VOLUME> --type <TYPE> [--price <PRICE>]
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
   * @dev Executes a command using the official Kraken Rust CLI binary.
   * Implements "Fail-Closed" principle.
   * Uses spawnSync with argument array to prevent command injection.
   *
   * @param commandParts - The command and its arguments (e.g., ['ticker', 'BTCUSD']
   *   or ['order', 'buy', 'BTCUSD', '0.001', '--type', 'market']).
   *   The global `-o json` flag is prepended automatically.
   * @returns Parsed JSON output from the CLI.
   * @throws Error if CLI execution fails, returns no output, or outputs invalid JSON.
   */
  private executeKrakenCli(commandParts: string[]): unknown {
    const krakenPath = process.env.KRAKEN_CLI_PATH || 'kraken';

    // Prepend the global JSON output flag
    const finalArgs = ['-o', 'json', ...commandParts];

    this.log('cli_exec', {
      binary: krakenPath,
      args: finalArgs,
      paperMode: this.isPaperMode(),
    });

    const result = spawnSync(krakenPath, finalArgs, {
        env: {
            ...process.env,
            KRAKEN_API_KEY: this.apiKey,
            // Pass both variants for compatibility with the kraken binary
            KRAKEN_API_SECRET: this.apiSecret,
            KRAKEN_SECRET: this.apiSecret,
        },
        stdio: ['inherit', 'pipe', 'pipe'],
        encoding: 'utf-8',
        timeout: 30000, // 30s timeout to prevent hanging
    });

    if (result.error) {
        throw new Error(`Failed to execute Kraken CLI: ${result.error.message}`);
    }

    // Capture stderr for rate-limit and error diagnostics
    const stderrOutput = result.stderr?.trim() || '';

    if (result.status !== null && result.status !== 0) {
        const errorDetail = stderrOutput || result.stdout?.trim() || 'Unknown CLI error';
        throw new Error(`Kraken CLI exited with code ${result.status}: ${errorDetail}`);
    }

    if (!result.stdout || !result.stdout.trim()) {
        throw new Error(`Kraken CLI returned no output. Stderr: ${stderrOutput}`);
    }

    try {
      const parsed = JSON.parse(result.stdout);

      // Handle Kraken API-level errors embedded in JSON
      if (parsed && typeof parsed === 'object' && 'error' in parsed && Array.isArray(parsed.error) && parsed.error.length > 0) {
        throw new Error(`Kraken API Error: ${parsed.error.join(', ')}`);
      }

      return parsed;
    } catch (error: unknown) {
      if (error instanceof Error) {
          throw error;
      }
      throw new Error(`Failed to parse Kraken CLI output: ${String(error)}`);
    }
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

            // Ticker always uses real market data, even in paper mode
            const cleanSymbol = symbol.replace('/', '');
            const result = this.executeKrakenCli(['ticker', cleanSymbol]);

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
            
            // Paper mode: `paper balance` | Live mode: `balance`
            const cmd = this.isPaperMode() ? ['paper', 'balance'] : ['balance'];
            const result = this.executeKrakenCli(cmd);
            const validated = BalanceSchema.parse(result);

            // Normalize paper balance format to flat key-value for consistent LLM output
            // Paper: {balances: {BTC: {available, reserved, total}}, mode} → {BTC: "0.01", USD: "9290.56"}
            let normalizedBalance: Record<string, string>;
            if (validated && typeof validated === 'object' && 'balances' in validated) {
              const paperData = validated as { balances: Record<string, { total: number }> };
              normalizedBalance = {};
              for (const [asset, info] of Object.entries(paperData.balances)) {
                normalizedBalance[asset] = info.total.toString();
              }
            } else {
              // Live format — already flat, normalize values to strings
              normalizedBalance = {};
              for (const [key, val] of Object.entries(validated as Record<string, string | number>)) {
                normalizedBalance[key] = String(val);
              }
            }

            return {
              content: [{ type: 'text', text: JSON.stringify(normalizedBalance) }],
            };
          }

          case 'get_trade_history': {
            this.log('tool_call', { tool: toolName });

            // Paper mode: `paper history` | Live mode: `trades-history`
            const cmd = this.isPaperMode() ? ['paper', 'history'] : ['trades-history'];
            const result = this.executeKrakenCli(cmd);
            const validated = TradeHistorySchema.parse(result);

            // Normalize paper trade history (array) to unified record format
            // Paper: {trades: [{id, side, price(num), ...}]} → {trades: {id: {ordertxid, type, price(str), ...}}, count}
            let normalizedHistory: { trades: Record<string, Record<string, unknown>>; count: number };

            if (Array.isArray(validated.trades)) {
              // Paper format — convert array to record with string-typed fields
              const tradesRecord: Record<string, Record<string, unknown>> = {};
              for (const trade of validated.trades) {
                const key = (trade as Record<string, unknown>).id as string
                  || (trade as Record<string, unknown>).order_id as string
                  || `trade-${Date.now()}`;
                const t = trade as Record<string, unknown>;
                tradesRecord[key] = {
                  ordertxid: t.order_id || t.id || '',
                  pair: t.pair,
                  time: typeof t.time === 'string' ? new Date(t.time as string).getTime() / 1000 : t.time,
                  type: t.side || t.type,
                  ordertype: t.ordertype || 'market',
                  price: String(t.price),
                  cost: String(t.cost),
                  fee: String(t.fee),
                  vol: String(t.volume || t.vol),
                };
              }
              const rawData = validated as Record<string, unknown>;
              normalizedHistory = {
                trades: tradesRecord,
                count: (rawData.filled_count as number) || Object.keys(tradesRecord).length,
              };
            } else {
              // Live format — already a record
              const rawData = validated as Record<string, unknown>;
              normalizedHistory = {
                trades: validated.trades as Record<string, Record<string, unknown>>,
                count: (rawData.count as number) || 0,
              };
            }

            return {
              content: [{ type: 'text', text: JSON.stringify(normalizedHistory) }],
            };
          }

          case 'place_order': {
            const params = OrderParamsSchema.parse(request.params.arguments);
            this.log('tool_call', { tool: toolName, params: params as unknown as Record<string, unknown> });

            const cleanSymbol = params.symbol.replace('/', '');

            // Paper mode: `paper buy/sell <PAIR> <VOL> ...`
            // Live mode:  `order buy/sell <PAIR> <VOL> ...`
            const cliArgs: string[] = this.isPaperMode()
              ? ['paper', params.side, cleanSymbol, params.amount.toString(), '--type', params.type]
              : ['order', params.side, cleanSymbol, params.amount.toString(), '--type', params.type];
            
            if (params.price) {
                cliArgs.push('--price', params.price.toString());
            }

            const result = this.executeKrakenCli(cliArgs);
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

        // According to Constitution v2.0.0: Fail-Closed on order execution security errors
        if (toolName === 'place_order') {
          throw new CriticalSecurityException(`Execution failure on Kraken CLI: ${errorMessage}`);
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
      message: 'Kraken MCP server running on stdio (CLI mode)',
      paperMode: this.isPaperMode(),
      version: '2.0.0',
    });
  }
}

// Entry point only if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new KrakenMcpServer();
  server.run().catch((error: Error) => {
    logger.error({
      event: 'startup_error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  });
}
