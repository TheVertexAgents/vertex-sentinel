import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import ccxt from 'ccxt';
import {
  TickerSchema,
  BalanceSchema,
  OrderParamsSchema,
  OrderResultSchema,
} from './types.js';
import { validateEnv } from '../../logic/env.js';
import { CriticalSecurityException } from '../../logic/errors.js';

/**
 * @title Kraken MCP Server
 * @dev Standardized MCP server for Kraken exchange interactions.
 * Decouples execution logic from the Sentinel Layer.
 */
export class KrakenMcpServer {
  private server: Server;
  private kraken: ccxt.kraken;

  constructor() {
    // Validate Environment first (Fail-Closed)
    const env = validateEnv();

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

    // Initialize Kraken via CCXT
    this.kraken = new ccxt.kraken({
      apiKey: env.KRAKEN_API_KEY,
      secret: env.KRAKEN_SECRET,
    });

    this.setupTools();
    
    this.server.onerror = (error) => {
      console.error(JSON.stringify({ 
        event: 'mcp_error', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      }));
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
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
      const timestamp = new Date().toISOString();

      try {
        switch (toolName) {
          case 'get_ticker': {
            const args = request.params.arguments as unknown as { symbol: string };
            const { symbol } = args;
            
            console.error(JSON.stringify({ event: 'tool_call', tool: toolName, symbol, timestamp }));
            
            const ticker = await this.kraken.fetchTicker(symbol);
            const validated = TickerSchema.parse(ticker);
            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          case 'get_balance': {
            console.error(JSON.stringify({ event: 'tool_call', tool: toolName, timestamp }));
            
            const balance = await this.kraken.fetchBalance();
            const total = balance.total;
            const validated = BalanceSchema.parse(total);
            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          case 'place_order': {
            const params = OrderParamsSchema.parse(request.params.arguments);
            console.error(JSON.stringify({ event: 'tool_call', tool: toolName, params, timestamp }));
            
            const order = await this.kraken.createOrder(
              params.symbol,
              params.type,
              params.side,
              params.amount,
              params.price
            );
            const validated = OrderResultSchema.parse(order);
            return {
              content: [{ type: 'text', text: JSON.stringify(validated) }],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${toolName}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({ 
          event: 'tool_error', 
          tool: toolName, 
          error: errorMessage, 
          timestamp 
        }));

        if (error instanceof Error && error.name === 'ZodError') {
          throw new McpError(ErrorCode.InvalidParams, `Validation error: ${errorMessage}`);
        }

        // According to Constitution v2.0.0: Fail-Closed on sensitive errors
        if (toolName === 'place_order') {
          throw new CriticalSecurityException(`Execution failure on Kraken: ${errorMessage}`);
        }

        throw new McpError(ErrorCode.InternalError, `Exchange error: ${errorMessage}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(JSON.stringify({ 
      event: 'server_start', 
      message: 'Kraken MCP server running on stdio', 
      timestamp: new Date().toISOString() 
    }));
  }
}

// Entry point only if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new KrakenMcpServer();
  server.run().catch((error) => {
    console.error(JSON.stringify({
      event: 'startup_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    process.exit(1);
  });
}
