import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RiskRouter (Viem Edition)", function () {
  let riskRouter: any;
  let mockRegistry: any;
  let publicClient: any;
  let walletClients: any[];
  let agent: any;
  let otherAccount: any;

  // EIP-712 Domain
  const domainName = "VertexAgents-Sentinel";
  const domainVersion = "1";

  beforeEach(async function () {
    const viem = (hre as any).viem;
    walletClients = await viem.getWalletClients();
    publicClient = await viem.getPublicClient();
    [, agent, otherAccount] = walletClients;

    // Deploy Mock Registry
    mockRegistry = await viem.deployContract("MockRegistry");

    // Deploy RiskRouter
    riskRouter = await viem.deployContract("RiskRouter", [getAddress(mockRegistry.address)]);
  });

  async function makeIntent(signerAccount: any, overrides: Partial<Record<string, any>> = {}) {
    const deadline = BigInt((await time.latest()) + 3600);
    return {
      agentId: 1n,
      agentWallet: signerAccount.account.address as `0x${string}`,
      pair: "BTC/USDC",
      action: "BUY",
      amountUsdScaled: 10000n, // $100
      maxSlippageBps: 50n,
      nonce: 0n,
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
    it("Should authorize a valid trade from an authorized agent", async function () {
      await riskRouter.write.addAgent([agent.account.address]);

      const intent = await makeIntent(agent);
      const signature = await getSignature(agent, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(true);
    });

    it("Should reject unauthorized agents", async function () {
      const intent = await makeIntent(otherAccount);
      const signature = await getSignature(otherAccount, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(false);
    });

    it("Should authorize if agent is in Registry (ERC-8004 Fallback)", async function () {
      await mockRegistry.write.setRegistered([otherAccount.account.address, true]);

      const intent = await makeIntent(otherAccount);
      const signature = await getSignature(otherAccount, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(true);
    });

    it("Should reject expired intents", async function () {
      await riskRouter.write.addAgent([agent.account.address]);

      const intent = await makeIntent(agent, {
        deadline: BigInt((await time.latest()) - 100), // Past
      });
      const signature = await getSignature(agent, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(false);
    });

    it("Should trigger circuit breaker on high amount", async function () {
      await riskRouter.write.addAgent([agent.account.address]);

      const intent = await makeIntent(agent, {
        amountUsdScaled: 10000001n, // Over $100,000 cap
      });
      const signature = await getSignature(agent, intent);

      const result = await riskRouter.read.authorizeTrade([intent, signature]);
      expect(result).to.equal(false);
    });
  });
});
