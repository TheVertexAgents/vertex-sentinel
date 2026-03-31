import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat, sepolia } from 'viem/chains';

// Minimal ABI for the events we care about
const RISK_ROUTER_ABI = parseAbi([
  'event TradeAuthorized(bytes32 indexed intentHash, address indexed agent, string pair, uint256 volume)',
  'event TradeRejected(bytes32 indexed intentHash, string reason)',
]);

type Network = 'local' | 'sepolia';

/**
 * @title ExecutionProxy
 * @dev The "Execution Layer" proxy that monitors the RiskRouter for
 * TradeAuthorized events and executes orders on the exchange.
 */
class ExecutionProxy {
  private client;
  private contractAddress: `0x${string}`;

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
   * @dev Starts listening for TradeAuthorized events from the on-chain RiskRouter.
   */
  startListener() {
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
   * @dev Simulates order execution on the Kraken exchange.
   * In production this would call the Kraken REST/WebSocket API.
   */
  private executeOnKraken(pair: string, volume: bigint) {
    console.log(`\n[KRAKEN] 📤 Submitting order...`);
    console.log(`[KRAKEN]   Action : BUY`);
    console.log(`[KRAKEN]   Pair   : ${pair}`);
    console.log(`[KRAKEN]   Volume : ${volume.toString()} wei`);
    console.log(`[KRAKEN]   Status : ✅ Accepted`);
    console.log(`[KRAKEN]   Order  : K-${Math.floor(Math.random() * 1_000_000)}`);
  }

  /**
   * @dev Process an authorized trade intent directly (non-event path, for testing).
   */
  async processAuthorizedTrade(pair: string, volume: bigint) {
    console.log(`[Execution Layer] Direct call: processing trade for ${pair}`);
    this.executeOnKraken(pair, volume);
  }
}

export default ExecutionProxy;
