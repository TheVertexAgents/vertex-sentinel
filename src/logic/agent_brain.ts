import { createWalletClient, http, parseEther } from 'viem';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import type { TradeIntent, Authorization } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

// EIP-712 Domain definition matching RiskRouter.sol
const domain = {
  name: 'VertexAgents-Sentinel',
  version: '1',
  chainId: 1,
  verifyingContract: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Update after deployment
} as const;

const types = {
  TradeIntent: [
    { name: 'agentId', type: 'string' },
    { name: 'pair', type: 'string' },
    { name: 'volume', type: 'uint256' },
    { name: 'maxPrice', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/**
 * @dev Mock "Strykr PRISM API" for canonical asset resolution.
 */
async function getAssetResolution(pair: string) {
  console.log(`[PRISM] Resolving canonical metadata for ${pair}...`);
  return { symbol: pair, precision: 18 };
}

/**
 * @dev The Intent Layer creates a signed TradeIntent.
 */
async function signIntent(intent: TradeIntent, privateKey: Hex): Promise<Authorization> {
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });

  console.log(`[Agent Brain] Intent Layer: Signing trade for ${intent.pair}...`);

  // Sign the intent using EIP-712
  const signature = await client.signTypedData({
    domain,
    types,
    primaryType: 'TradeIntent',
    message: intent,
  });

  return { isAllowed: true, reason: "EIP-712 Signature Generated", signature };
}

// Logic loop demo
async function main() {
  console.log("VertexAgents Sentinel Brain Initialization...");

  // Demo Intent
  const demoIntent: TradeIntent = {
    agentId: "AGENT_VERIFIED_001",
    pair: "BTC/USDC",
    volume: parseEther("0.5"),
    maxPrice: parseEther("65000"),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  };

  // Use a dummy private key if one is not provided in .env
  const pk = (process.env.AGENT_PRIVATE_KEY as Hex) || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  const auth = await signIntent(demoIntent, pk);
  console.log("--- AUTHORIZATION ARTIFACT ---");
  console.log(auth);
  console.log("--- END ---");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { signIntent, getAssetResolution };
