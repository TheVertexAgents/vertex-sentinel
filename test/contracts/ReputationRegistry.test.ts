import { expect, use } from "chai";
import chaiAsPromised from 'chai-as-promised';
import hre from "hardhat";
import { getAddress, keccak256, toBytes } from "viem";

use(chaiAsPromised);

describe("ReputationRegistry", function () {
  let reputationRegistry: any;
  let agentRegistry: any;
  let walletClients: any[];
  let owner: any;
  let agentWallet: any;
  let rater: any;

  beforeEach(async function () {
    const viem = (hre as any).viem;
    walletClients = await viem.getWalletClients();
    [owner, agentWallet, rater] = walletClients;

    agentRegistry = await viem.deployContract("AgentRegistry");
    reputationRegistry = await viem.deployContract("ReputationRegistry", [getAddress(agentRegistry.address)]);

    await agentRegistry.write.register([
      agentWallet.account.address,
      "Agent 1",
      "Desc",
      ["trading"],
      "uri"
    ]);
  });

  it("Should allow submitting feedback", async function () {
    const agentId = 1n;
    const score = 85;
    const outcomeRef = keccak256(toBytes("trade-1"));
    const comment = "Great execution";
    const feedbackType = 0; // TRADE_EXECUTION

    await reputationRegistry.write.submitFeedback([
      agentId,
      score,
      outcomeRef,
      comment,
      feedbackType
    ], { account: rater.account });

    expect(await reputationRegistry.read.getAverageScore([agentId])).to.equal(BigInt(score));
  });

  it("Should prevent self-rating", async function () {
    const agentId = 1n;
    await expect(reputationRegistry.write.submitFeedback([
      agentId,
      100,
      keccak256(toBytes("ref")),
      "Me rating myself",
      0
    ], { account: owner.account })).to.be.rejectedWith("ReputationRegistry: operator cannot self-rate");
  });
});
