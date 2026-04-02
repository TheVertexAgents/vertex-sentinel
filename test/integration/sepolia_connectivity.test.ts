import { expect } from "chai";
import fs from "fs";
import path from "path";
import ExecutionProxy from "../../src/execution/proxy.js";

describe("Sepolia Connectivity & Configuration", () => {
  const deploymentsPath = path.join(process.cwd(), "deployments_sepolia.json");
  const backupPath = path.join(process.cwd(), "deployments_sepolia.json.bak");

  before(() => {
    // Backup existing deployment file if it exists
    if (fs.existsSync(deploymentsPath)) {
      fs.copyFileSync(deploymentsPath, backupPath);
    }

    // Set environment variables for testing
    process.env.INFURA_KEY = "test-infura-key";
    process.env.AGENT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    process.env.KRAKEN_API_KEY = "test-key";
    process.env.KRAKEN_SECRET = "test-secret";
    process.env.GOOGLE_GENAI_API_KEY = "test-genai-key";
  });

  after(() => {
    // Restore backup
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, deploymentsPath);
      fs.unlinkSync(backupPath);
    } else if (fs.existsSync(deploymentsPath)) {
      fs.unlinkSync(deploymentsPath);
    }

    delete process.env.NETWORK;
  });

  it("should fail to initialize Brain if NETWORK=sepolia and deployments file is missing", async function() {
    this.timeout(10000);
    if (fs.existsSync(deploymentsPath)) fs.unlinkSync(deploymentsPath);
    process.env.NETWORK = "sepolia";

    try {
      await import(`../../src/logic/agent_brain.js?update=${Date.now()}`);
      expect.fail("Should have thrown CriticalSecurityException");
    } catch (error: any) {
      expect(error.message).to.contain("Fail-Closed: deployments_sepolia.json is missing");
    }
  });

  it("should correctly load addresses from deployments_sepolia.json in Brain", async () => {
    const mockDeployments = {
      network: "sepolia",
      chainId: 11155111,
      riskRouter: "0x1234567890123456789012345678901234567890",
      agentAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    };
    fs.writeFileSync(deploymentsPath, JSON.stringify(mockDeployments));
    process.env.NETWORK = "sepolia";

    const brain = await import(`../../src/logic/agent_brain.js?update=${Date.now()}`);
    // We can't easily check the private 'domain' constant, but we can verify it doesn't throw
    expect(brain).to.not.be.undefined;
  });

  it("should fail to initialize Proxy if network=sepolia and deployments file is missing", () => {
    if (fs.existsSync(deploymentsPath)) fs.unlinkSync(deploymentsPath);

    expect(() => {
      new ExecutionProxy(undefined, 'sepolia');
    }).to.throw("Fail-Closed: deployments_sepolia.json is missing");
  });

  it("should correctly load address in Proxy from deployments_sepolia.json", () => {
    const mockAddress = "0x1234567890123456789012345678901234567890";
    const mockDeployments = {
      network: "sepolia",
      chainId: 11155111,
      riskRouter: mockAddress,
      agentAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    };
    fs.writeFileSync(deploymentsPath, JSON.stringify(mockDeployments));

    const proxy = new ExecutionProxy(undefined, 'sepolia');
    // @ts-ignore - accessing private member for verification
    expect(proxy.contractAddress.toLowerCase()).to.equal(mockAddress.toLowerCase());
  });
});
