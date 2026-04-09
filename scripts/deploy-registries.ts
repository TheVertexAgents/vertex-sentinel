import hre from "hardhat";
import fs from "fs";
import path from "path";
import { getAddress } from "viem";

async function main() {
  const { viem } = hre;
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log("--- Deploying Vertex Sentinel Registries ---");
  console.log("Deployer:", deployer.account.address);

  // 1. AgentRegistry
  console.log("Deploying AgentRegistry...");
  const agentRegistry = await viem.deployContract("AgentRegistry");
  console.log("AgentRegistry deployed to:", agentRegistry.address);

  // 2. RiskRouter
  console.log("Deploying RiskRouter...");
  const riskRouter = await viem.deployContract("RiskRouter", [getAddress(agentRegistry.address)]);
  console.log("RiskRouter deployed to:", riskRouter.address);

  // 3. ReputationRegistry
  console.log("Deploying ReputationRegistry...");
  const reputationRegistry = await viem.deployContract("ReputationRegistry", [getAddress(agentRegistry.address)]);
  console.log("ReputationRegistry deployed to:", reputationRegistry.address);

  // 4. ValidationRegistry
  console.log("Deploying ValidationRegistry...");
  const validationRegistry = await viem.deployContract("ValidationRegistry", [getAddress(agentRegistry.address), true]);
  console.log("ValidationRegistry deployed to:", validationRegistry.address);

  // 5. HackathonVault
  console.log("Deploying HackathonVault...");
  const allocation = 50000000000000000n; // 0.05 ETH
  const hackathonVault = await viem.deployContract("HackathonVault", [getAddress(agentRegistry.address), allocation]);
  console.log("HackathonVault deployed to:", hackathonVault.address);

  const deployments = {
    network: hre.network.name,
    chainId: await publicClient.getChainId(),
    agentRegistry: agentRegistry.address,
    riskRouter: riskRouter.address,
    reputationRegistry: reputationRegistry.address,
    validationRegistry: validationRegistry.address,
    hackathonVault: hackathonVault.address,
    deployedAt: new Date().toISOString()
  };

  const filePath = path.join(process.cwd(), `deployments_${hre.network.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
  console.log(`Deployments saved to ${filePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
