import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

// Minimal ABI for the events we care about
const RISK_ROUTER_ABI = parseAbi([
  'event TradeAuthorized(bytes32 indexed intentHash, address indexed agent, string pair, uint256 volume)',
  'event TradeRejected(bytes32 indexed intentHash, string reason)',
]);

type Network = 'local' | 'sepolia';

/**
 * @title ExecutionProxy
 * @dev The "Execution Layer" proxy that monitors the RiskRouter for
 * TradeAuthorized events and executes orders on the exchange via an MCP server.
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
    console.log(`[Execution Layer] Proxy Initialized.`);
    console.log(`[Execution Layer] Network: ${network} | RiskRouter: ${contractAddress}`);
  }

  /**
   * @dev Initializes the connection to the Kraken MCP server.
   */
  async initMcp() {
    console.log(`[Execution Layer] Initializing Kraken MCP Client...`);
    
    // Path to the MCP server implementation
    const serverPath = path.join(__dirname, '../mcp/kraken/index.ts');
    
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['ts-node', serverPath],
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
    console.log(`[Execution Layer] Connected to Kraken MCP Server.`);
  }

  /**
   * @dev Starts listening for TradeAuthorized events from the on-chain RiskRouter.
   */
  async startListener() {
    if (!this.mcpClient) {
      await this.initMcp();
    }
    
    console.log(`[Execution Layer] Monitoring for TradeAuthorized events...`);

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
          console.log(`\n[Execution Layer] ✅ TRADE AUTHORIZED ON-CHAIN`);
          console.log(`  Intent Hash : ${intentHash}`);
          console.log(`  Agent       : ${agent}`);
          console.log(`  Pair        : ${pair}`);
          console.log(`  Volume      : ${volume.toString()} wei`);
          this.executeOnKraken(pair, volume);
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
          console.log(`\n[Execution Layer] 🚫 TRADE REJECTED BY SENTINEL`);
          console.log(`  Intent Hash : ${intentHash}`);
          console.log(`  Reason      : ${reason}`);
        }
      },
    });
  }

  /**
   * @dev Calls the Kraken MCP server to execute an order.
   */
  private async executeOnKraken(pair: string, volume: bigint) {
    if (!this.mcpClient) {
      console.error('[Execution Layer] MCP Client not initialized');
      return;
    }

    console.log(`\n[KRAKEN] 📤 Submitting order via MCP...`);
    
    try {
      // Note: In a real scenario, we'd need to map 'pair' to Kraken symbol format
      // and 'volume' from wei to base currency units.
      const result = await this.mcpClient.callTool({
        name: 'place_order',
        arguments: {
          symbol: pair, // Assuming pair is already in correct format for this demo
          side: 'buy',
          type: 'market',
          amount: Number(volume) / 1e18, // Convert from wei for demo purposes
        },
      });

      const content = (result as any).content;
      const resultText = (content[0] as { type: 'text'; text: string }).text;
      console.log(`[KRAKEN] MCP Result:`, JSON.parse(resultText));
    } catch (error: any) {
      console.error(`[KRAKEN] 🚫 Order Execution Failed:`, error.message);
    }
  }

  /**
   * @dev Process an authorized trade intent directly (non-event path, for testing).
   */
  async processAuthorizedTrade(pair: string, volume: bigint) {
    console.log(`[Execution Layer] Direct call: processing trade for ${pair}`);
    await this.executeOnKraken(pair, volume);
  }
}

export default ExecutionProxy;
