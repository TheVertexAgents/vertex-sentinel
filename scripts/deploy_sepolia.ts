import hre from "hardhat";
import fs from "fs";
import path from "path";
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import dotenv from 'dotenv';
import util from "util";
import { logger } from "../src/utils/logger.js";

dotenv.config();

// Official Shared Contract Addresses (Sepolia)
const SHARED_CONFIG = {
  agentRegistry: "0x97b07dDc405B0c28B17559aFFE63BdB3632d0ca3",
  hackathonVault: "0x0E7CD8ef9743FEcf94f9103033a044caBD45fC90",
  riskRouter: "0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC",
  reputationRegistry: "0x423a9904e39537a9997fbaF0f220d79D7d545763",
  validationRegistry: "0x92bF63E5C7Ac6980f237a7164Ab413BE226187F1"
} as const;

// ABIs extracted from SHARED_CONTRACTS.md
const AGENT_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentWallet", type: "address" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "capabilities", type: "string[]" },
      { name: "agentURI", type: "string" }
    ],
    outputs: [{ name: "agentId", type: "uint256" }]
  },
  {
    name: "isRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "registered", type: "bool" }]
  }
] as const;

const HACKATHON_VAULT_ABI = [
  {
    name: "claimAllocation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: []
  },
  {
    name: "hasClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "claimed", type: "bool" }]
  }
] as const;

async function main() {
  const walletClients = await viem.getWalletClients();
  if (walletClients.length === 0) {
      throw new Error("No wallet clients found. Check AGENT_PRIVATE_KEY and Hardhat configuration.");
  }
  const [operatorWallet] = walletClients;
  const publicClient = await viem.getPublicClient();

  logger.info(`--- Vertex Sentinel Onboarding (Sepolia) ---`);
  logger.info(`Operator Wallet: ${operatorWallet.account.address}`);

  // 1. Resolve Agent Wallet
  let AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
  if (!AGENT_PRIVATE_KEY) {
      throw new Error("AGENT_PRIVATE_KEY is missing from .env");
  }
  if (!AGENT_PRIVATE_KEY.startsWith("0x")) {
      AGENT_PRIVATE_KEY = "0x" + AGENT_PRIVATE_KEY;
  }
  const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY as Hex);
  const agentAddress = agentAccount.address;
  logger.info(`Agent Wallet Address: ${agentAddress}`);

  // 2. Load/Check Local Config
  const deploymentsPath = path.join(process.cwd(), "deployments_sepolia.json");
  let deployments = { agentId: "" };
  
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  }

  let agentIdStr: string = deployments.agentId;

  // 3. Register Agent if not ID found
  if (agentIdStr && agentIdStr !== "PENDING_VERIFICATION") {
    logger.info(`Agent already registered locally with ID: ${agentIdStr}`);
  } else {
    logger.info(`Registering agent "${process.env.AGENT_NAME || 'Vertex Sentinel Layer'}"...`);
    
    const hash = await operatorWallet.writeContract({
      address: SHARED_CONFIG.agentRegistry as Hex,
      abi: AGENT_REGISTRY_ABI,
      functionName: "register",
      args: [
        agentAddress,
        process.env.AGENT_NAME || "Vertex Sentinel Layer",
        "A verifiable risk-management layer for autonomous AI agents.",
        ["trading", "risk-management", "eip712-signing"],
        "https://vertex-agents.com/metadata.json"
      ]
    });

    logger.info(`Registration transaction sent: ${hash}`);
    logger.info(`Waiting for confirmation...`);
    
    await publicClient.waitForTransactionReceipt({ hash });
    
    logger.info(`--- SUCCESS ---`);
    logger.info(`Agent Registered! PLEASE PARSE your agentId from Etherscan logs:`);
    logger.info(`https://sepolia.etherscan.io/tx/${hash}`);
    logger.info(`Then update agentId in deployments_sepolia.json`);
    
    agentIdStr = "PENDING_VERIFICATION"; 
  }

  // 4. Claim Allocation
  if (agentIdStr && agentIdStr !== "PENDING_VERIFICATION") {
      const agentId = BigInt(agentIdStr);
      
      // Check if already claimed
      const alreadyClaimed = await publicClient.readContract({
          address: SHARED_CONFIG.hackathonVault as Hex,
          abi: HACKATHON_VAULT_ABI,
          functionName: "hasClaimed",
          args: [agentId]
      }) as boolean;

      if (alreadyClaimed) {
          logger.info(`Sandbox capital (0.05 ETH) already claimed for agentId: ${agentId}`);
      } else {
          logger.info(`Claiming 0.05 ETH sandbox capital...`);
          try {
              const claimHash = await operatorWallet.writeContract({
                address: SHARED_CONFIG.hackathonVault as Hex,
                abi: HACKATHON_VAULT_ABI,
                functionName: "claimAllocation",
                args: [agentId]
              });
              logger.info(`Claim successful: ${claimHash}`);
          } catch (e: any) {
              logger.error(`Claim failed: ${e.message}`);
          }
      }
  }

  // 5. Finalize Configuration
  const updatedDeployments = {
    network: "sepolia",
    chainId: 11155111,
    ...SHARED_CONFIG,
    agentAddress: agentAddress,
    agentId: agentIdStr,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(updatedDeployments, null, 2));
  logger.info(`Updated deployments saved to ${deploymentsPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("--- SCRIPT FAILED ---");
    if (error instanceof Error) {
        logger.error(`Error Message: ${error.message}`);
        logger.error(`Error Stack: ${error.stack}`);
    } else {
        logger.error("Full Error Object:", util.inspect(error, { depth: null, colors: true }));
    }
    process.exit(1);
  });
