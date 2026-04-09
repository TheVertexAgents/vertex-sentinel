import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RiskRouter (Strengthened)", function () {
  let riskRouter: any;
  let agentRegistry: any;
  let publicClient: any;
  let walletClients: any[];
  let owner: any;
  let agentWallet: any;
  let otherAccount: any;

  const domainName = "VertexAgents-Sentinel";
  const domainVersion = "1";

  beforeEach(async function () {
    const viem = (hre as any).viem;
    walletClients = await viem.getWalletClients();
    publicClient = await viem.getPublicClient();
    [owner, agentWallet, otherAccount] = walletClients;

    // Deploy AgentRegistry
    agentRegistry = await viem.deployContract("AgentRegistry");

    // Deploy RiskRouter
    riskRouter = await viem.deployContract("RiskRouter", [getAddress(agentRegistry.address)]);

    // Register an agent
    await agentRegistry.write.register([
      agentWallet.account.address,
      "Sentinel Agent",
      "Desc",
      ["trading"],
      "uri"
    ]);
  });

  async function makeIntent(agentId: bigint, signerAccount: any, overrides: Partial<Record<string, any>> = {}) {
    const deadline = BigInt((await time.latest()) + 3600);
    return {
      agentId,
      agentWallet: signerAccount.account.address as `0x${string}`,
      pair: "BTC/USDC",
      action: "BUY",
      amountUsdScaled: 10000n, // 00
      maxSlippageBps: 50n,
      nonce: await riskRouter.read.getIntentNonce([agentId]),
      deadline,
      ...overrides,
    };
  }

  async function getSignature(signer: any, intent: any) {
    const domain = {
      name: domainName,
      version: domainVersion,
      chainId: await publicClient.getChainId(),
      verifyingContract: riskRouter.address as `0x${string}`,
    };

    const types = {
      TradeIntent: [
        { name: "agentId", type: "uint256" },
        { name: "agentWallet", type: "address" },
        { name: "pair", type: "string" },
        { name: "action", type: "string" },
        { name: "amountUsdScaled", type: "uint256" },
        { name: "maxSlippageBps", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    return await signer.signTypedData({
      domain,
      types,
      primaryType: "TradeIntent",
      message: intent,
    });
  }

  describe("Authorization Logic", function () {
    it("Should authorize a valid trade from a registered agent", async function () {
      const agentId = 1n;
      const intent = await makeIntent(agentId, agentWallet);
      const signature = await getSignature(agentWallet, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(true);
    });

    it("Should reject agent wallet mismatch", async function () {
      const agentId = 1n;
      const intent = await makeIntent(agentId, otherAccount); // Wrong wallet
      const signature = await getSignature(otherAccount, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(false);
    });

    it("Should enforce per-agent risk parameters", async function () {
      const agentId = 1n;
      // Set strict risk params
      await riskRouter.write.setRiskParams([agentId, 5000n, 100n, 5n]); // Max 0

      const intent = await makeIntent(agentId, agentWallet, {
        amountUsdScaled: 6000n // 0 > 0
      });
      const signature = await getSignature(agentWallet, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(false);
    });

    it("Should enforce nonce increment", async function () {
      const agentId = 1n;
      const intent = await makeIntent(agentId, agentWallet);
      const signature = await getSignature(agentWallet, intent);

      // First trade
      await riskRouter.write.authorizeTrade([intent, signature]);

      // Replay same intent (same nonce)
      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(false);
    });
  });
});
