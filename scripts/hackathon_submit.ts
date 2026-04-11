import { createPublicClient, createWalletClient, http, parseEther, keccak256, toHex, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import type { Hex } from 'viem';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { signIntent } from '../src/logic/agent_brain.js';
import type { TradeIntent } from '../src/logic/types.js';
import { logger } from '../src/utils/logger.js';

dotenv.config();

const deploymentsPath = path.join(process.cwd(), 'deployments_sepolia.json');

const RISK_ROUTER_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "agentId", "type": "uint256" },
          { "internalType": "address", "name": "agentWallet", "type": "address" },
          { "internalType": "string", "name": "pair", "type": "string" },
          { "internalType": "string", "name": "action", "type": "string" },
          { "internalType": "uint256", "name": "amountUsdScaled", "type": "uint256" },
          { "internalType": "uint256", "name": "maxSlippageBps", "type": "uint256" },
          { "internalType": "uint256", "name": "nonce", "type": "uint256" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "internalType": "struct RiskRouter.TradeIntent",
        "name": "intent",
        "type": "tuple"
      },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "submitTradeIntent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agentId", "type": "uint256" }
    ],
    "name": "getIntentNonce",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const VALIDATION_REGISTRY_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "agentId", "type": "uint256" },
      { "internalType": "bytes32", "name": "checkpointHash", "type": "bytes32" },
      { "internalType": "uint8", "name": "score", "type": "uint8" },
      { "internalType": "uint8", "name": "proofType", "type": "uint8" },
      { "internalType": "bytes", "name": "proof", "type": "bytes" },
      { "internalType": "string", "name": "notes", "type": "string" }
    ],
    "name": "postAttestation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

async function executeHackathonSubmission() {
    logger.info('--- Vertex Sentinel Hackathon Submission (Sepolia) ---');

    if (!fs.existsSync(deploymentsPath)) {
        logger.error('deployments_sepolia.json not found! Have you registered your agent?');
        process.exit(1);
    }
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));

    const agentIdStr = deployments.agentId;
    if (!agentIdStr || agentIdStr === 'PENDING_VERIFICATION') {
        logger.error('Invalid agentId in deployments. Please complete agent registration first.');
        process.exit(1);
    }
    const agentId = BigInt(agentIdStr);

    const PKEY = process.env.AGENT_PRIVATE_KEY as Hex;
    if (!PKEY) {
        logger.error('AGENT_PRIVATE_KEY missing in .env');
        process.exit(1);
    }

    const account = privateKeyToAccount(PKEY);
    logger.info(`Agent Wallet: ${account.address}`);
    logger.info(`Agent ID: ${agentIdStr}`);

    const publicClient = createPublicClient({ chain: sepolia, transport: http() });
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

    try {
        // --- STEP 0: Fetch Nonce ---
        logger.info(`Fetching nonce for agent ${agentId}...`);
        const nonce = await publicClient.readContract({
            address: deployments.riskRouter as Hex,
            abi: RISK_ROUTER_ABI,
            functionName: 'getIntentNonce',
            args: [agentId]
        });
        logger.info(`Current Nonce: ${nonce}`);

        // --- STEP 1: Generate & Sign Intent ---
        logger.info('\n=== STEP 1/2: Generating Agent Intent ===');
        const demoIntent: TradeIntent = {
            agentId,
            agentWallet: account.address,
            pair: "ETH/USDC",
            action: "BUY",
            amountUsdScaled: 10000n, // $100.00 (under 500 cap)
            maxSlippageBps: 100n,
            nonce,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hr deadline
        };

        const authResult = await signIntent(demoIntent, PKEY);
        
        if (!authResult.isAllowed) {
             logger.error(`Agent Brain rejected trade: ${authResult.reason}`);
             process.exit(1);
        }

        logger.info(`Agent authorized trade: ${authResult.reason}`);
        logger.info(`Signature generated successfully.`);

        // Create Checkpoint Hash from the trade parameters and reason
        const checkpointData = `Pair: ${demoIntent.pair}, Amount: ${demoIntent.amountUsdScaled.toString()}, Reasoning: ${authResult.reason}`;
        const checkpointHash = keccak256(stringToHex(checkpointData));

        // --- STEP 2: Submit to Risk Router ---
        logger.info('\n=== STEP 2a: Submitting to RiskRouter (On-Chain) ===');
        const rrHash = await walletClient.writeContract({
            address: deployments.riskRouter as Hex,
            abi: RISK_ROUTER_ABI,
            functionName: 'submitTradeIntent',
            args: [demoIntent, authResult.signature as Hex]
        });
        logger.info(`RiskRouter transaction sent: ${rrHash}`);
        logger.info('Waiting for confirmation...');
        await publicClient.waitForTransactionReceipt({ hash: rrHash });
        logger.info('✅ RiskRouter trade approved on chain!');

        // --- STEP 3: Post ValidationRegistry Checkpoint ---
        logger.info('\n=== STEP 2b: Posting to ValidationRegistry (On-Chain) ===');
        const vrHash = await walletClient.writeContract({
            address: deployments.validationRegistry as Hex,
            abi: VALIDATION_REGISTRY_ABI,
            functionName: 'postAttestation',
            args: [agentId, checkpointHash, 100, 1, '0x', "Hackathon submission"]
        });
        logger.info(`ValidationRegistry transaction sent: ${vrHash}`);
        logger.info('Waiting for confirmation...');
        await publicClient.waitForTransactionReceipt({ hash: vrHash });
        logger.info('✅ Validation Checkpoint committed to chain!');
        
        // --- STEP 4: Update Local Audit Trail ---
        const checkpointLog = {
            timestamp: new Date().toISOString(),
            agentId: Number(agentId),
            pair: demoIntent.pair,
            action: demoIntent.action,
            amountUsdScaled: Number(demoIntent.amountUsdScaled),
            reasoning: authResult.reason,
            checkpointHash,
            riskRouterTx: rrHash,
            validationRegistryTx: vrHash
        };
        fs.appendFileSync(path.join(process.cwd(), 'checkpoints.jsonl'), JSON.stringify(checkpointLog) + '\n');
        logger.info(`✅ Local audit trail updated in checkpoints.jsonl`);
        
        logger.info('\n🎉 HURRAY! Your Sentinel Agent is fully submitted to the leaderboard with the official Path B protocol!');
        logger.info(`You are now accumulating reputation points correctly.`);

    } catch (error) {
        logger.error(`Execution Failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

executeHackathonSubmission();
