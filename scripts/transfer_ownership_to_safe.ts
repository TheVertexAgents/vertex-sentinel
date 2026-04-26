import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, hardhat } from 'viem/chains';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const RISK_ROUTER_ABI = [
  {
    inputs: [{ name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  }
] as const;

/**
 * @dev Transfers ownership of the RiskRouter contract to a Gnosis Safe or any other address.
 */
async function main() {
  const safeAddress = process.env.SAFE_OWNER_ADDRESS as Hex;
  const network = process.env.NETWORK || 'local';
  const chainId = network === 'sepolia' ? 11155111 : 31337;
  const chain = chainId === 11155111 ? sepolia : hardhat;

  if (!safeAddress) {
    console.error('❌ Error: SAFE_OWNER_ADDRESS is not set in environment.');
    process.exit(1);
  }

  const pk = process.env.AGENT_PRIVATE_KEY as Hex;
  if (!pk) {
    console.error('❌ Error: AGENT_PRIVATE_KEY is not set in environment.');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk);

  // Load router address from deployments
  let routerAddress: Hex | undefined;
  const deploymentsPath = path.join(process.cwd(), `deployments_${network === 'sepolia' ? 'sepolia' : 'hardhat'}.json`);

  if (fs.existsSync(deploymentsPath)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    routerAddress = deployments.riskRouter;
  }

  if (!routerAddress) {
      // Fallback for hackathon
      if (network === 'sepolia') {
          routerAddress = '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC';
      } else {
          console.error('❌ Error: Could not determine RiskRouter address.');
          process.exit(1);
      }
  }

  console.log(`🚀 Transferring ownership of RiskRouter at ${routerAddress} to ${safeAddress}...`);

  const rpcUrl = network === 'sepolia'
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`
    : process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  try {
    const hash = await walletClient.writeContract({
      address: routerAddress,
      abi: RISK_ROUTER_ABI,
      functionName: 'transferOwnership',
      args: [safeAddress],
    });

    console.log(`✅ Transaction submitted! Hash: ${hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`✨ Ownership successfully transferred to ${safeAddress}!`);
      console.log('NOTE: RiskRouter uses Ownable2Step. The new owner MUST call acceptOwnership() to finalize the transfer.');
    } else {
      console.error('❌ Transaction failed.');
    }
  } catch (error: any) {
    console.error(`❌ Error during ownership transfer: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
