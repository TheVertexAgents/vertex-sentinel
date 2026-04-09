import { expect, use } from "chai";
import chaiAsPromised from 'chai-as-promised';
import hre from "hardhat";
import { getAddress, keccak256, toBytes } from "viem";

use(chaiAsPromised);

describe("ValidationRegistry", function () {
  let validationRegistry: any;
  let agentRegistry: any;
  let walletClients: any[];
  let agentWallet: any;
  let validator: any;

  beforeEach(async function () {
    const viem = (hre as any).viem;
    walletClients = await viem.getWalletClients();
    [, agentWallet, validator] = walletClients;

    agentRegistry = await viem.deployContract("AgentRegistry");
    validationRegistry = await viem.deployContract("ValidationRegistry", [getAddress(agentRegistry.address), false]);

    await agentRegistry.write.register([
      agentWallet.account.address,
      "Agent 1",
      "Desc",
      ["trading"],
      "uri"
    ]);

    await validationRegistry.write.addValidator([validator.account.address]);
  });

  it("Should allow posting attestation", async function () {
    const agentId = 1n;
    const checkpointHash = keccak256(toBytes("checkpoint-1"));
    const score = 90;

    await validationRegistry.write.postAttestation([
      agentId,
      checkpointHash,
      score,
      0, // EIP712
      "0x",
      "Valid trade"
    ], { account: validator.account });

    expect(await validationRegistry.read.getAverageValidationScore([agentId])).to.equal(BigInt(score));
  });

  it("Should prevent non-validators from posting", async function () {
    const agentId = 1n;
    await expect(validationRegistry.write.postAttestation([
      agentId,
      keccak256(toBytes("cp")),
      90,
      0,
      "0x",
      "notes"
    ], { account: agentWallet.account })).to.be.rejectedWith("ValidationRegistry: not an authorized validator");
  });
});
