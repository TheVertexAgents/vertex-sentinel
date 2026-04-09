import { expect, use } from "chai";
import chaiAsPromised from 'chai-as-promised';
import hre from "hardhat";
import { getAddress, parseEther } from "viem";

use(chaiAsPromised);

describe("HackathonVault", function () {
  let vault: any;
  let agentRegistry: any;
  let walletClients: any[];
  let owner: any;
  let team: any;

  beforeEach(async function () {
    const viem = (hre as any).viem;
    walletClients = await viem.getWalletClients();
    [owner, team] = walletClients;

    agentRegistry = await viem.deployContract("AgentRegistry");
    vault = await viem.deployContract("HackathonVault", [getAddress(agentRegistry.address), parseEther("0.1")]);

    // Fund the vault
    await owner.sendTransaction({
      to: vault.address,
      value: parseEther("1.0")
    });
  });

  it("Should allow claiming allocation after registration", async function () {
    const agentWallet = "0x0000000000000000000000000000000000000001";
    await agentRegistry.write.register([
      agentWallet,
      "Team Agent",
      "Desc",
      [],
      "uri"
    ], { account: team.account });

    const agentId = 1n;
    await vault.write.claimAllocation([agentId]);

    expect(await vault.read.allocatedCapital([agentId])).to.equal(parseEther("0.1"));
  });

  it("Should fail if agent not registered", async function () {
    await expect(vault.write.claimAllocation([99n])).to.be.rejectedWith("HackathonVault: agent not registered");
  });
});
