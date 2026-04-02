import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal ABI for the events we care about
const RISK_ROUTER_ABI = parseAbi([
  'event TradeAuthorized(bytes32 indexed intentHash, address indexed agent, string pair, uint256 volume)',
  'event TradeRejected(bytes32 indexed intentHash, string reason)',
]);

type Network = 'local' | 'sepolia';

interface McpContent {
  type: string;
  text: string;
}

interface McpResult {
  content: McpContent[];
}

/**
 * @title ExecutionProxy
 * @dev The "Execution Layer" proxy that monitors the RiskRouter for
 * TradeAuthorized events and executes orders on the exchange via modular MCP.
 * Strictly adheres to Project Constitution v2.0.0.
 */
class ExecutionProxy {
  private client;
  private contractAddress: `0x${string}`;
  private mcpClient: Client | null = null;

  constructor(contractAddress: `0x${string}`, network: Network = 'local') {
    this.contractAddress = contractAddress;
    this.client = createPublicClient({
      chain: network === 'sepolia' ? sepolia : hardhat,
      transport: http(
        network === 'sepolia'
          ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`
          : 'http://127.0.0.1:8545'
      ),
    });
    this.log('INFO', 'Execution Layer Proxy Initialized', { network, contractAddress });
  }

  /**
   * @dev Structured JSON logging to stderr as mandated by Constitution v2.0.0.
   */
  private log(level: 'INFO' | 'ERROR' | 'CRITICAL', message: string, data: Record<string, unknown> = {}) {
    console.error(JSON.stringify({
      level,
      module: 'ExecutionProxy',
      message,
      ...data,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * @dev Initializes the connection to the Kraken MCP server.
   */
  async initMcp() {
    this.log('INFO', 'Initializing Kraken MCP Client connection...');
    
    // Path to the modular MCP server implementation
    const serverPath = path.join(__dirname, '../mcp/kraken/index.ts');
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['--loader', 'ts-node/esm', '--no-warnings', serverPath],
    });

    this.mcpClient = new Client(
      {
        name: 'sentinel-execution-proxy',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await this.mcpClient.connect(transport);
    this.log('INFO', 'Successfully connected to Kraken MCP Server.');
  }

  /**
   * @dev Starts listening for TradeAuthorized events from the on-chain RiskRouter.
   */
  async startListener() {
    if (!this.mcpClient) {
      await this.initMcp();
    }
    
    this.log('INFO', 'Monitoring for TradeAuthorized events on-chain...');

    // Listen for authorized trades
    this.client.watchContractEvent({
      address: this.contractAddress,
      abi: RISK_ROUTER_ABI,
      eventName: 'TradeAuthorized',
      onLogs: (logs) => {
        for (const log of logs) {
          const { intentHash, agent, pair, volume } = log.args as {
            intentHash: `0x${string}`;
            agent: `0x${string}`;
            pair: string;
            volume: bigint;
          };

          this.log('INFO', 'TRADE AUTHORIZED ON-CHAIN', {
              intentHash,
              agent,
              pair,
              volume: volume.toString()
          });

          this.executeOnKraken(pair, volume).catch(err => {
              this.log('ERROR', 'Background trade execution failed', { error: err.message });
          });
        }
      },
    });

    // Listen for rejected trades (for logging/alerting)
    this.client.watchContractEvent({
      address: this.contractAddress,
      abi: RISK_ROUTER_ABI,
      eventName: 'TradeRejected',
      onLogs: (logs) => {
        for (const log of logs) {
          const { intentHash, reason } = log.args as {
            intentHash: `0x${string}`;
            reason: string;
          };

          this.log('INFO', 'TRADE REJECTED BY SENTINEL', {
              intentHash,
              reason
          });
        }
      },
    });
  }

  /**
   * @dev Calls the Kraken MCP server to execute an order.
   * Implements "Fail-Closed" behavior.
   */
  private async executeOnKraken(pair: string, volume: bigint) {
    if (!this.mcpClient) {
      this.log('ERROR', 'MCP Client not initialized. Cannot execute trade.');
      return;
    }

    this.log('INFO', 'Submitting order via MCP...', { pair, volume: volume.toString() });
    
    try {
      // Constitution Alignment: Unit conversion and symbol formatting
      const amount = parseFloat(formatEther(volume));
      const cleanSymbol = pair.replace('/', '');

      const result = await this.mcpClient.callTool({
        name: 'place_order',
        arguments: {
          symbol: cleanSymbol,
          side: 'buy',
          type: 'market',
          amount: amount
        },
      }) as unknown as McpResult;

      const content = result.content;
      const resultData = JSON.parse(content[0].text) as Record<string, unknown>;

      this.log('INFO', 'MCP Order Execution Success', { result: resultData });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('CRITICAL', 'Order Execution Failed (Fail-Closed)', { error: errorMessage });
    }
  }

  /**
   * @dev Process an authorized trade intent directly (non-event path, for testing).
   */
  async processAuthorizedTrade(pair: string, volume: bigint) {
    if (!this.mcpClient) {
        await this.initMcp();
    }
    this.log('INFO', 'Processing direct trade authorization', { pair, volume: volume.toString() });
    await this.executeOnKraken(pair, volume);
  }
}

export default ExecutionProxy;
