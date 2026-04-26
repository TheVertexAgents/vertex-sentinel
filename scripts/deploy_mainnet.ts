import hre from "hardhat";
import fs from "fs";
import path from "path";
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import dotenv from 'dotenv';
import util from "util";
import { logger } from "../src/utils/logger.js";

dotenv.config();

/**
 * @dev Deploy Vertex Sentinel Contracts to Mainnet (or L2) and transfer ownership to a Gnosis Safe.
 */
async function main() {
  const viem = (hre as any).viem;
  const network = hre.network.name;

  if (network === 'sepolia' || network === 'localhost') {
    logger.warn(`Deploying to ${network}. Ensure this is intended for production-like testing.`);
  }

  const walletClients = await viem.getWalletClients();
  if (walletClients.length === 0) {
      throw new Error("No wallet clients found. Check AGENT_PRIVATE_KEY and Hardhat configuration.");
  }
  const [deployer] = walletClients;
  const publicClient = await viem.getPublicClient();

  logger.info(`--- Vertex Sentinel Mainnet Deployment ---`);
  logger.info(`Network: ${network}`);
  logger.info(`Deployer Wallet: ${deployer.account.address}`);

  // 1. Gnosis Safe Address (Must be provided via env)
  const GNOSIS_SAFE_ADDRESS = process.env.GNOSIS_SAFE_ADDRESS as Hex;
  if (!GNOSIS_SAFE_ADDRESS) {
    logger.error("GNOSIS_SAFE_ADDRESS is missing from .env");
    process.exit(1);
  }
  logger.info(`Target Gnosis Safe (New Owner): ${GNOSIS_SAFE_ADDRESS}`);

  // 2. Deploy Contracts
  logger.info("Deploying AgentRegistry...");
  const agentRegistry = await viem.deployContract("AgentRegistry");
  logger.info(`AgentRegistry deployed to: ${agentRegistry.address}`);

  logger.info("Deploying RiskRouter...");
  const riskRouter = await viem.deployContract("RiskRouter", [agentRegistry.address]);
  logger.info(`RiskRouter deployed to: ${riskRouter.address}`);

  logger.info("Deploying ReputationRegistry...");
  const reputationRegistry = await viem.deployContract("ReputationRegistry", [agentRegistry.address]);
  logger.info(`ReputationRegistry deployed to: ${reputationRegistry.address}`);

  logger.info("Deploying ValidationRegistry...");
  const validationRegistry = await viem.deployContract("ValidationRegistry", [agentRegistry.address, true]); // true for openValidation
  logger.info(`ValidationRegistry deployed to: ${validationRegistry.address}`);

  // 3. Transfer Ownership to Gnosis Safe
  // ReputationRegistry does not have an owner.
  // RiskRouter and AgentRegistry use Ownable2Step.
  // ValidationRegistry uses Ownable.

  logger.info(`Transferring ownership of all contracts to ${GNOSIS_SAFE_ADDRESS}...`);

  const ownable2StepContracts = [
    { name: "RiskRouter", instance: riskRouter },
    { name: "AgentRegistry", instance: agentRegistry }
  ];

  const ownableContracts = [
    { name: "ValidationRegistry", instance: validationRegistry }
  ];

  for (const contract of ownable2StepContracts) {
    logger.info(`Transferring ownership of ${contract.name} (Ownable2Step)...`);
    const hash = await deployer.writeContract({
        address: contract.instance.address,
        abi: (contract.instance as any).abi,
        functionName: 'transferOwnership',
        args: [GNOSIS_SAFE_ADDRESS]
    });
    await publicClient.waitForTransactionReceipt({ hash });
    logger.info(`${contract.name} ownership transfer initiated (TX: ${hash})`);
  }

  for (const contract of ownableContracts) {
    logger.info(`Transferring ownership of ${contract.name} (Ownable)...`);
    const hash = await deployer.writeContract({
        address: contract.instance.address,
        abi: (contract.instance as any).abi,
        functionName: 'transferOwnership',
        args: [GNOSIS_SAFE_ADDRESS]
    });
    await publicClient.waitForTransactionReceipt({ hash });
    logger.info(`${contract.name} ownership transferred (TX: ${hash})`);
  }

  logger.info("NOTE: Ownership transfer must be ACCEPTED by the Gnosis Safe via acceptOwnership() for RiskRouter and AgentRegistry.");

  // 4. Save Deployment Config
  const deploymentsPath = path.join(process.cwd(), `deployments_${network}.json`);
  const deployments = {
    network: network,
    chainId: await publicClient.getChainId(),
    agentRegistry: agentRegistry.address,
    riskRouter: riskRouter.address,
    reputationRegistry: reputationRegistry.address,
    validationRegistry: validationRegistry.address,
    owner: GNOSIS_SAFE_ADDRESS,
    deployer: deployer.account.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  logger.info(`Deployment details saved to ${deploymentsPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("--- DEPLOYMENT FAILED ---");
    if (error instanceof Error) {
        logger.error(`Error Message: ${error.message}`);
        logger.error(`Error Stack: ${error.stack}`);
    } else {
        logger.error("Full Error Object:", util.inspect(error, { depth: null, colors: true }));
    }
    process.exit(1);
  });
