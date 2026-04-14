import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { CriticalSecurityException } from '../logic/errors.js';
import { loadAgentMetadata } from '../logic/config.js';
import { logger } from '../utils/logger.js';

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
  private agentAddress: `0x${string}`;
  private auditLogPath = path.join(process.cwd(), 'logs/audit.json');

  constructor(contractAddress?: `0x${string}`, network: Network = 'sepolia') {
    // If contractAddress is not provided, try loading from deployments_sepolia.json if network is sepolia
    if (!contractAddress && network === 'sepolia') {
      const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');
      if (!fs.existsSync(deploymentsPath)) {
        throw new CriticalSecurityException('Fail-Closed: deployments_sepolia.json is missing but network is set to sepolia');
      }
      try {
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
        this.contractAddress = deployments.riskRouter;
      } catch (error) {
        throw new CriticalSecurityException(`Fail-Closed: Failed to load deployments_sepolia.json: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      this.contractAddress = contractAddress || '0x0000000000000000000000000000000000000000';
    }

    this.client = createPublicClient({
      chain: network === 'sepolia' ? sepolia : hardhat,
      transport: http(
        network === 'sepolia'
          ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`
          : process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545'
      ),
    });

    const pk = process.env.AGENT_PRIVATE_KEY as Hex;
    if (!pk) {
        throw new CriticalSecurityException('AGENT_PRIVATE_KEY is missing from environment');
    }
    this.agentAddress = privateKeyToAccount(pk).address;

    this.log('INFO', 'Execution Layer Proxy Initialized', {
        network,
        contractAddress: this.contractAddress,
        agentAddress: this.agentAddress,
        chainId: network === 'sepolia' ? 11155111 : 31337
    });

    // Ensure logs directory exists
    const logsDir = path.dirname(this.auditLogPath);
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * @dev Structured JSON logging to stderr as mandated by Constitution v2.0.0.
   */
  private log(level: 'INFO' | 'ERROR' | 'CRITICAL', message: string, data: Record<string, unknown> = {}) {
    logger.error({
      level,
      module: 'ExecutionProxy',
      message,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * @dev Audit logging to JSONL file.
   */
  private auditLog(data: Record<string, unknown>) {
    const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        ...data
    });
    fs.appendFileSync(this.auditLogPath, entry + '\n');
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
      env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development',
          KRAKEN_CLI_PATH: process.env.KRAKEN_CLI_PATH || 'kraken'
      } as Record<string, string>
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

          // Phase B: Agent ID Verification (Strict Check)
          if (agent.toLowerCase() !== this.agentAddress.toLowerCase()) {
              this.log('CRITICAL', 'SECURITY_BREACH_ATTEMPT: Unauthorized agent address in event', {
                  expected: this.agentAddress,
                  actual: agent,
                  intentHash
              });
              // Fail-Closed: Halt or ignore? Request says "halt"
              throw new CriticalSecurityException(`Security Breach: Unauthorized agent ${agent}`);
          }

          this.executeOnKraken(pair, volume, intentHash).catch(err => {
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
  private async executeOnKraken(pair: string, volume: bigint, traceId: string) {
    if (!this.mcpClient) {
      this.log('ERROR', 'MCP Client not initialized. Cannot execute trade.');
      return;
    }

    this.log('INFO', 'Submitting order via MCP...', { TRACE_ID: traceId, pair, volume: volume.toString() });
    
    try {
      const config = loadAgentMetadata();
      // Constitution Alignment: Unit conversion and symbol formatting.
      // Replace formatEther (10^18) with scaling factor based on config.usdScalingFactor.
      const amount = Number(volume) / config.usdScalingFactor;
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
      const resultData = JSON.parse(content[0].text) as Record<string, any>;

      const orderId = resultData.txid ? resultData.txid[0] : (resultData.order_id || 'UNKNOWN');

      this.log('INFO', 'MCP Order Execution Success', { TRACE_ID: traceId, result: resultData });

      // Audit Logging
      this.auditLog({
          traceId,
          orderId,
          agentId: this.agentAddress,
          pair,
          volume: amount.toString(),
          executionPrice: resultData.price || 0,
          txHash: resultData.txid ? resultData.txid[0] : 'N/A', // Uses orderId as txHash identifier for Kraken orders
          krakenStatus: 'success'
      });

    } catch (error: unknown) {
      const config = loadAgentMetadata();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('CRITICAL', 'Order Execution Failed (Fail-Closed)', { TRACE_ID: traceId, error: errorMessage });

      this.auditLog({
          traceId,
          agentId: this.agentAddress,
          pair,
          volume: (Number(volume) / config.usdScalingFactor).toString(),
          krakenStatus: 'failed',
          error: errorMessage
      });

      throw new CriticalSecurityException(`Execution failure: ${errorMessage}`);
    }
  }

  /**
   * @dev Process an authorized trade intent directly (non-event path, for testing).
   */
  async processAuthorizedTrade(pair: string, volume: bigint, traceId: string = 'test-trace') {
    if (!this.mcpClient) {
        await this.initMcp();
    }
    this.log('INFO', 'Processing direct trade authorization', { traceId, pair, volume: volume.toString() });
    await this.executeOnKraken(pair, volume, traceId);
  }
}

export default ExecutionProxy;
