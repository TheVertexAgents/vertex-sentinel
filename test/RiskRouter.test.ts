import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import hre from "hardhat";
const { ethers } = hre as any;
import { parseEther } from "ethers";
import pkgHelpers from "@nomicfoundation/hardhat-network-helpers";
const { time } = pkgHelpers;

describe("RiskRouter", function () {
  let riskRouter: any;
  let mockRegistry: any;
  let owner: any;
  let agent: any;
  let otherAccount: any;

  // EIP-712 Domain
  const domainName = "VertexAgents-Sentinel";
  const domainVersion = "1";

  beforeEach(async function () {
    [owner, agent, otherAccount] = await ethers.getSigners();

    // Deploy Mock Registry
    const MockRegistry = await ethers.getContractFactory("MockRegistry");
    mockRegistry = await MockRegistry.deploy();

    // Deploy RiskRouter
    const RiskRouter = await ethers.getContractFactory("RiskRouter");
    riskRouter = await RiskRouter.deploy(await mockRegistry.getAddress());
  });

  async function getSignature(signer: any, intent: any) {
    const domain = {
      name: domainName,
      version: domainVersion,
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await riskRouter.getAddress(),
    };

    const types = {
      TradeIntent: [
        { name: "agentId", type: "string" },
        { name: "pair", type: "string" },
        { name: "volume", type: "uint256" },
        { name: "maxPrice", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    return await signer.signTypedData(domain, types, intent);
  }

  describe("Authorization Logic", function () {
    it("Should authorize a valid trade from an authorized agent", async function () {
      await riskRouter.addAgent(agent.address);
      
      const deadline = (await time.latest()) + 3600;
      const intent = {
        agentId: "AGENT_001",
        pair: "BTC/USDC",
        volume: parseEther("10"),
        maxPrice: parseEther("60000"),
        deadline: deadline,
      };

      const signature = await getSignature(agent, intent);

      await expect(riskRouter.authorizeTrade(intent, signature) as any)
        .to.emit(riskRouter, "TradeAuthorized")
        .withArgs(await riskRouter.hashTradeIntent(intent), agent.address, intent.pair, intent.volume);
    });

    it("Should reject un-authorized and un-registered agents", async function () {
      const deadline = (await time.latest()) + 3600;
      const intent = {
        agentId: "AGENT_001",
        pair: "BTC/USDC",
        volume: parseEther("10"),
        maxPrice: parseEther("60000"),
        deadline: deadline,
      };

      const signature = await getSignature(otherAccount, intent);

      await expect(riskRouter.authorizeTrade(intent, signature) as any)
        .to.emit(riskRouter, "TradeRejected")
        .withArgs(await riskRouter.hashTradeIntent(intent), "Unauthorized or Unregistered Agent");
    });

    it("Should authorize if agent is in Registry (ERC-8004 Fallback)", async function () {
      // Not in authorizedAgents mapping, but in registry
      await mockRegistry.setRegistered(otherAccount.address, true);

      const deadline = (await time.latest()) + 3600;
      const intent = {
        agentId: "AGENT_001",
        pair: "BTC/USDC",
        volume: parseEther("10"),
        maxPrice: parseEther("60000"),
        deadline: deadline,
      };

      const signature = await getSignature(otherAccount, intent);

      const result = await riskRouter.authorizeTrade.staticCall(intent, signature);
      expect(result).to.equal(true);
    });

    it("Should reject expired intents", async function () {
      await riskRouter.addAgent(agent.address);
      
      const deadline = (await time.latest()) - 100; // Past
      const intent = {
        agentId: "AGENT_001",
        pair: "BTC/USDC",
        volume: parseEther("10"),
        maxPrice: parseEther("60000"),
        deadline: deadline,
      };

      const signature = await getSignature(agent, intent);

      await expect(riskRouter.authorizeTrade(intent, signature) as any)
        .to.emit(riskRouter, "TradeRejected")
        .withArgs(await riskRouter.hashTradeIntent(intent), "Intent Expired");
    });

    it("Should trigger circuit breaker on high volume", async function () {
        await riskRouter.addAgent(agent.address);
        
        const deadline = (await time.latest()) + 3600;
        const intent = {
          agentId: "AGENT_001",
          pair: "BTC/USDC",
          volume: parseEther("101"), // Over 100 limit
          maxPrice: parseEther("60000"),
          deadline: deadline,
        };
  
        const signature = await getSignature(agent, intent);
  
        await expect(riskRouter.authorizeTrade(intent, signature) as any)
          .to.emit(riskRouter, "TradeRejected")
          .withArgs(await riskRouter.hashTradeIntent(intent), "Circuit Breaker: Volume Exceeded");
      });
  });
});
