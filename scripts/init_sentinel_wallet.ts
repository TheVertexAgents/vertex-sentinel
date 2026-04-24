import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error("Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in .env");
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
    baseUrl: "https://api.circle.com"
  });

  console.log("🚀 Initializing Sentinel Agent Circle Wallet...");

  const walletSetResponse = await client.createWalletSet({
    name: "Sentinel Agent Set",
  });

  const walletSetId = walletSetResponse.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Failed to create Wallet Set");

  const walletResponse = await client.createWallets({
    blockchains: ["ARC-TESTNET" as any],
    count: 1,
    walletSetId: walletSetId,
    accountType: "EOA",
  });

  const wallets = walletResponse.data?.wallets;
  if (!wallets || wallets.length === 0) throw new Error("Failed to create Sentinel Wallet");

  const sentinelAgent = wallets[0];

  console.log("\n✨ SENTINEL WALLET CREATED ✨");
  console.log("--------------------------------------------------");
  console.log(`Agent Address: ${sentinelAgent.address}`);
  console.log(`Agent Wallet ID: ${sentinelAgent.id}`);
  console.log("--------------------------------------------------");

  const envPath = path.join(process.cwd(), ".env");
  const newEnvVars = `
# Generated Sentinel Circle Wallet
AGENT_WALLET_ID="${sentinelAgent.id}"
AGENT_WALLET_ADDRESS="${sentinelAgent.address}"
`;

  fs.appendFileSync(envPath, newEnvVars);
  console.log("\n✅ .env file updated with AGENT_WALLET_ID.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
