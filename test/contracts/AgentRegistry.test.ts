import { expect, use } from "chai";
import chaiAsPromised from 'chai-as-promised';
import hre from "hardhat";
import { getAddress, keccak256, toBytes } from "viem";

use(chaiAsPromised);

describe("AgentRegistry", function () {
  let agentRegistry: any;
  let publicClient: any;
  let walletClients: any[];
  let owner: any;
  let agentWallet: any;

  beforeEach(async function () {
    const viem = (hre as any).viem;
    walletClients = await viem.getWalletClients();
    publicClient = await viem.getPublicClient();
    [owner, agentWallet] = walletClients;

    agentRegistry = await viem.deployContract("AgentRegistry");
  });

  it("Should register an agent correctly", async function () {
    const name = "Sentinel-1";
    const description = "Test Agent";
    const capabilities = ["trading"];
    const agentURI = "ipfs://test";

    await agentRegistry.write.register([
      agentWallet.account.address,
      name,
      description,
      capabilities,
      agentURI
    ]);

    const agentId = 1n;
    const agent = await agentRegistry.read.agents([agentId]);

    // Viem returns structs as arrays usually, but let's check the fields
    expect(agent[0].toLowerCase()).to.equal(owner.account.address.toLowerCase()); // operatorWallet
    expect(agent[1].toLowerCase()).to.equal(agentWallet.account.address.toLowerCase()); // agentWallet
    expect(agent[2]).to.equal(name);

    expect(await agentRegistry.read.ownerOf([agentId])).to.equal(getAddress(owner.account.address));
    expect(await agentRegistry.read.tokenURI([agentId])).to.equal(agentURI);
  });

  it("Should fail if name is empty", async function () {
    await expect(agentRegistry.write.register([
      agentWallet.account.address,
      "",
      "Desc",
      [],
      "uri"
    ])).to.be.rejectedWith("AgentRegistry: name required");
  });

  it("Should verify agent signature correctly", async function () {
    const name = "Sentinel-1";
    const agentURI = "ipfs://test";
    await agentRegistry.write.register([
      agentWallet.account.address,
      name,
      "Desc",
      ["trading"],
      agentURI
    ]);

    const agentId = 1n;
    const contentHash = keccak256(toBytes("Hello World"));

    // EIP-712 Message
    const domain = {
      name: "VertexAgents-Sentinel",
      version: "1",
      chainId: await publicClient.getChainId(),
      verifyingContract: agentRegistry.address
    };

    const types = {
      AgentMessage: [
        { name: "agentId", type: "uint256" },
        { name: "agentWallet", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "contentHash", type: "bytes32" },
      ]
    };

    const signature = await agentWallet.signTypedData({
      domain,
      types,
      primaryType: "AgentMessage",
      message: {
        agentId,
        agentWallet: agentWallet.account.address,
        nonce: 0n,
        contentHash
      }
    });

    const isValid = await agentRegistry.read.verifyAgentSignature([
      agentId,
      contentHash,
      signature
    ]);

    expect(isValid).to.equal(true);
  });
});
