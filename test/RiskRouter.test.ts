import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RiskRouter (Viem Edition)", function () {
  let riskRouter: any;
  let agentRegistry: any;
  let publicClient: any;
  let walletClients: any[];
  let agent: any;

  const domainName = "RiskRouter";
  const domainVersion = "1";

  beforeEach(async function () {
    const viem = (hre as any).viem;
    walletClients = await viem.getWalletClients();
    publicClient = await viem.getPublicClient();
    [, agent] = walletClients;

    agentRegistry = await viem.deployContract("AgentRegistry");
    riskRouter = await viem.deployContract("RiskRouter", [getAddress(agentRegistry.address)]);

    // Register agent
    await agentRegistry.write.register([
      agent.account.address,
      "Test Agent",
      "Desc",
      ["trade"],
      "uri"
    ]);
  });

  async function makeIntent(overrides: Partial<Record<string, any>> = {}) {
    const deadline = BigInt((await time.latest()) + 3600);
    return {
      agentId: 0n,
      agentWallet: agent.account.address as `0x${string}`,
      pair: "BTC/USDC",
      action: "BUY",
      amountUsdScaled: 10000n,
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

  it("Should approve a valid signed intent", async function () {
    const intent = await makeIntent();
    const signature = await getSignature(agent, intent);

    const [approved] = await riskRouter.read.submitTradeIntent([intent, signature]);
    expect(approved).to.equal(true);
  });

  it("Should reject expired intents", async function () {
    const intent = await makeIntent({
      deadline: BigInt((await time.latest()) - 100)
    });
    const signature = await getSignature(agent, intent);

    const [approved] = await riskRouter.read.submitTradeIntent([intent, signature]);
    expect(approved).to.equal(false);
  });

  it("Should reject intents exceeding risk params", async function () {
    await riskRouter.write.setRiskParams([0n, 5000n, 500n, 10n]);

    const intent = await makeIntent({ amountUsdScaled: 6000n });
    const signature = await getSignature(agent, intent);

    const [approved] = await riskRouter.read.submitTradeIntent([intent, signature]);
    expect(approved).to.equal(false);
  });
});
