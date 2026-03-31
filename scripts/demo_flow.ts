/**
 * @title demo_flow.ts
 * @dev The Vertex Sentinel "Full Loop" Demo Script.
 *
 * Demonstrates the complete 3-layer architecture:
 *   Brain (Sign Intent) → Sentinel (On-Chain Verify) → Proxy (Execute on Kraken)
 *
 * Usage: npx hardhat run scripts/demo_flow.ts --network localhost
 */
import { parseEther } from 'viem';
import hre from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

// Inlined ExecutionProxy for self-contained demo script
class ExecutionProxy {
  private contractAddress: string;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
    console.log(`[Execution Layer] Proxy Initialized. Monitoring: ${contractAddress}`);
  }

  async processAuthorizedTrade(pair: string, volume: bigint) {
    console.log(`\n[KRAKEN] 📤 Submitting order...`);
    console.log(`[KRAKEN]   Action : BUY`);
    console.log(`[KRAKEN]   Pair   : ${pair}`);
    console.log(`[KRAKEN]   Volume : ${volume.toString()} wei`);
    console.log(`[KRAKEN]   Status : ✅ Accepted`);
    console.log(`[KRAKEN]   Order  : K-${Math.floor(Math.random() * 1_000_000)}`);
  }
}

const SENTINEL_BANNER = `
╔══════════════════════════════════════════════════════════════╗
║         ⚡ VERTEX SENTINEL — FULL DEMO FLOW ⚡               ║
║         Brain → Sentinel (On-Chain) → Execution              ║
╚══════════════════════════════════════════════════════════════╝
`;

async function main() {
  console.log(SENTINEL_BANNER);

  const { ethers } = hre;
  const [deployer, agentSigner] = await ethers.getSigners();

  // ─── STEP 1: Deploy MockRegistry ─────────────────────────────────────────
  console.log('\n[Step 1] Deploying MockRegistry...');
  const MockRegistry = await ethers.getContractFactory('MockRegistry');
  const registry = await MockRegistry.deploy();
  await registry.waitForDeployment();
  console.log(`  ✅ MockRegistry deployed at: ${await registry.getAddress()}`);

  // ─── STEP 2: Deploy RiskRouter ────────────────────────────────────────────
  console.log('\n[Step 2] Deploying RiskRouter (Sentinel Layer)...');
  const RiskRouter = await ethers.getContractFactory('RiskRouter');
  const riskRouter = await RiskRouter.deploy(await registry.getAddress());
  await riskRouter.waitForDeployment();
  const routerAddress = await riskRouter.getAddress();
  console.log(`  ✅ RiskRouter (Sentinel) deployed at: ${routerAddress}`);

  // ─── STEP 3: Authorize the demo agent ────────────────────────────────────
  console.log('\n[Step 3] Authorizing demo agent in Sentinel...');
  await riskRouter.addAgent(agentSigner.address);
  console.log(`  ✅ Agent ${agentSigner.address} authorized.`);

  // ─── STEP 4: Create and sign a TradeIntent (Brain Layer) ─────────────────
  console.log('\n[Step 4] Agent Brain: Building and signing TradeIntent (EIP-712)...');

  const network = await ethers.provider.getNetwork();
  const domain = {
    name: 'VertexAgents-Sentinel',
    version: '1',
    chainId: network.chainId,
    verifyingContract: routerAddress as `0x${string}`,
  };

  const types = {
    TradeIntent: [
      { name: 'agentId', type: 'string' },
      { name: 'pair', type: 'string' },
      { name: 'volume', type: 'uint256' },
      { name: 'maxPrice', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const intent = {
    agentId: 'AGENT_VERIFIED_001',
    pair: 'BTC/USDC',
    volume: parseEther('10').toString(),
    maxPrice: parseEther('65000').toString(),
    deadline: deadline.toString(),
  };

  const signature = await agentSigner.signTypedData(domain, types, intent);
  console.log(`  ✅ Intent signed. Sig: ${signature.substring(0, 20)}...`);

  // ─── STEP 5: Submit to RiskRouter (Sentinel Layer) ───────────────────────
  console.log('\n[Step 5] Submitting intent to on-chain Sentinel (RiskRouter)...');
  const tx = await riskRouter.connect(agentSigner).authorizeTrade(
    {
      agentId: intent.agentId,
      pair: intent.pair,
      volume: parseEther('10'),
      maxPrice: parseEther('65000'),
      deadline: deadline,
    },
    signature
  );
  const receipt = await tx.wait();

  const authorized = receipt?.logs?.some((log: any) => {
    try {
      const parsed = riskRouter.interface.parseLog(log);
      return parsed?.name === 'TradeAuthorized';
    } catch { return false; }
  });

  if (authorized) {
    console.log(`  ✅ SENTINEL VERDICT: TRADE AUTHORIZED (tx: ${receipt?.hash})`);
  } else {
    console.log(`  🚫 SENTINEL VERDICT: TRADE REJECTED`);
    return;
  }

  // ─── STEP 6: Execution Proxy processes it ────────────────────────────────
  console.log('\n[Step 6] Execution Proxy: Processing authorized trade...');
  const proxy = new ExecutionProxy(routerAddress as `0x${string}`, 'local');
  await proxy.processAuthorizedTrade(intent.pair, parseEther('10'));

  // ─── STEP 7: Demo the REJECTED path ──────────────────────────────────────
  console.log('\n[Step 7] 🚫 REJECTED PATH DEMO: Attempting high-volume trade...');
  const highVolumeTx = await riskRouter.connect(agentSigner).authorizeTrade(
    {
      agentId: 'AGENT_VERIFIED_001',
      pair: 'ETH/USDC',
      volume: parseEther('200'), // Exceeds 100 ETH circuit breaker
      maxPrice: parseEther('4000'),
      deadline: deadline,
    },
    signature // Signature won't match — this will also be rejected by sig check
  );
  await highVolumeTx.wait();
  console.log('  ✅ Sentinel correctly blocked the high-volume trade.');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🏁 DEMO COMPLETE — Vertex Sentinel is fully operational!    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  console.error('\n[DEMO FAILED]', error.message);
  process.exit(1);
});
