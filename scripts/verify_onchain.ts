import hre from "hardhat";
const { viem } = hre;
import fs from "fs";
import path from "path";
import { getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  const deploymentsPath = path.join(process.cwd(), "deployments_sepolia.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`Deployment file not found at ${deploymentsPath}. Run deploy_sepolia.ts first.`);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const riskRouterAddress = deployments.riskRouter;
  const agentAddress = deployments.agentAddress;

  console.log(`Verifying deployment on-chain for RiskRouter at ${riskRouterAddress}...`);

  const riskRouter = await viem.getContractAt("RiskRouter", riskRouterAddress);

  // Check if agent is authorized
  const isAuthorized = await riskRouter.read.authorizedAgents([agentAddress]);

  console.log(`Agent ${agentAddress} authorization status: ${isAuthorized}`);

  if (isAuthorized) {
    console.log("✅ Verification Successful: Agent is authorized on-chain.");
  } else {
    console.error("❌ Verification Failed: Agent is NOT authorized on-chain.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
