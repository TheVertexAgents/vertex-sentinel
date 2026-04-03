import hre from "hardhat";
const { viem } = hre;
import fs from "fs";
import path from "path";
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

async function main() {
  const [deployer] = await viem.getWalletClients();
  console.log(`Deploying contracts with the account: ${deployer.account.address}`);

  let AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
  if (!AGENT_PRIVATE_KEY) {
      throw new Error("AGENT_PRIVATE_KEY is missing from environment");
  }
  if (!AGENT_PRIVATE_KEY.startsWith("0x")) {
      AGENT_PRIVATE_KEY = "0x" + AGENT_PRIVATE_KEY;
  }
  const agentAddress = privateKeyToAccount(AGENT_PRIVATE_KEY as Hex).address;
  console.log(`Target Agent Address: ${agentAddress}`);

  // 1. Deploy MockRegistry
  console.log("Deploying MockRegistry...");
  const mockRegistry = await viem.deployContract("MockRegistry");
  console.log(`MockRegistry deployed to: ${mockRegistry.address}`);

  // 2. Deploy RiskRouter
  console.log("Deploying RiskRouter...");
  const riskRouter = await viem.deployContract("RiskRouter", [mockRegistry.address]);
  console.log(`RiskRouter deployed to: ${riskRouter.address}`);

  // 3. Post-Deployment Handshake: Call riskRouter.addAgent(AGENT_ADDRESS)
  console.log(`Adding agent ${agentAddress} to RiskRouter...`);
  const hash = await riskRouter.write.addAgent([agentAddress]);
  console.log(`Agent added. Transaction hash: ${hash}`);

  // 4. Save addresses to deployments_sepolia.json
  const deployments = {
    network: "sepolia",
    chainId: 11155111,
    mockRegistry: mockRegistry.address,
    riskRouter: riskRouter.address,
    agentAddress: agentAddress,
    timestamp: new Date().toISOString()
  };

  const deploymentsPath = path.join(process.cwd(), "deployments_sepolia.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`Deployment addresses saved to ${deploymentsPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
