import { expect } from "chai";
import hre from "hardhat";
import { getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import path from 'path';
import fs from 'fs';
import sinon from 'sinon';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { signIntent } from "../../src/logic/agent_brain.js";
import ExecutionProxy from "../../src/execution/proxy.js";
import { IdentityClient } from "../../src/onchain/identity.js";

describe("Sentinel Full Loop Integration", function () {
  let riskRouter: any;
  let mockRegistry: any;
  let publicClient: any;
  let walletClient: any;
  let agentAccount: any;
  let sandbox: sinon.SinonSandbox;

  const agentPrivateKey: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  before(async function () {
    sandbox = sinon.createSandbox();

    // Mock MCP Client
    sandbox.stub(Client.prototype, 'connect').resolves();
    sandbox.stub(Client.prototype, 'callTool').callsFake(async (args: any): Promise<any> => {
        if (args.name === 'get_ticker') {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        a: ["50000.0", "1", "1.000"],
                        b: ["49900.0", "1", "1.000"],
                        h: ["50050.0", "50100.0"],
                        l: ["49950.0", "50000.0"]
                    })
                }]
            };
        }
        if (args.name === 'place_order') {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        txid: ["O12345-67890-ABCDE"],
                        price: 50000.0
                    })
                }]
            };
        }
        return { content: [] };
    });

    // Set environment for tests
    process.env.GOOGLE_GENAI_API_KEY = "test-key";
    process.env.AGENT_PRIVATE_KEY = agentPrivateKey;
    process.env.KRAKEN_API_KEY = "test-kraken-key";
    process.env.KRAKEN_SECRET = "test-kraken-secret";
    process.env.INFURA_KEY = "test-infura-key";

    const viem = (hre as any).viem;
    publicClient = await viem.getPublicClient();
    agentAccount = privateKeyToAccount(agentPrivateKey);
    walletClient = await viem.getWalletClient(agentAccount.address);

    // Deploy Mock Registry
    mockRegistry = await viem.deployContract("MockRegistry");

    // Deploy RiskRouter
    riskRouter = await viem.deployContract("RiskRouter", [getAddress(mockRegistry.address)]);

    // Add agent to RiskRouter
    const { request } = await publicClient.simulateContract({
        address: riskRouter.address,
        abi: riskRouter.abi,
        functionName: 'addAgent',
        args: [agentAccount.address],
        account: agentAccount
    });
    await walletClient.writeContract(request);

    // Mock agent-id.json for tests
    const agentIdPath = path.join(process.cwd(), 'agent-id.json');
    if (!fs.existsSync(agentIdPath)) {
      fs.writeFileSync(agentIdPath, JSON.stringify({
        name: "Test Agent",
        version: "1.0.0",
        agentId: 1
      }));
    }

    // Mock Identity check in the Client
    sandbox.stub(IdentityClient.prototype, 'isAgentRegistered').resolves(true);
  });

  after(function () {
    sandbox.restore();
  });

  it("Should assessment, sign, authorize on-chain, and execute on Kraken", async function () {
    const auditLogPath = process.env.AUDIT_LOG_PATH || path.join(process.cwd(), 'logs/audit.json');
    if (fs.existsSync(auditLogPath)) fs.unlinkSync(auditLogPath);

    // 1. Brain: Create and Sign Intent
    const deadline = BigInt((await time.latest()) + 3600);
    const intent = {
      agentId: 1n,
      agentWallet: agentAccount.address,
      pair: "BTC/USDC",
      action: "BUY",
      amountUsdScaled: 10000n, // $100.00
      maxSlippageBps: 50n,     // 0.5%
      nonce: 0n,
      deadline: deadline,
    };

    const auth = await signIntent(intent, agentPrivateKey);
    expect(auth.isAllowed).to.be.true;

    // 2. RiskRouter: Authorize Trade on-chain
    const domain = {
        name: 'VertexAgents-Sentinel',
        version: '1',
        chainId: 31337, // Hardhat
        verifyingContract: riskRouter.address as `0x${string}`,
    };
    const types = {
        TradeIntent: [
          { name: 'agentId', type: 'uint256' },
          { name: 'agentWallet', type: 'address' },
          { name: 'pair', type: 'string' },
          { name: 'action', type: 'string' },
          { name: 'amountUsdScaled', type: 'uint256' },
          { name: 'maxSlippageBps', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
    };
    const signature = await walletClient.signTypedData({
        domain,
        types,
        primaryType: 'TradeIntent',
        message: intent,
    });

    // 3. Execution Proxy: Listen and Execute
    const proxy = new ExecutionProxy(riskRouter.address, 'local');
    await proxy.initMcp();

    // Trigger the on-chain authorization
    const { request } = await publicClient.simulateContract({
        address: riskRouter.address,
        abi: riskRouter.abi,
        functionName: 'authorizeTrade',
        args: [intent, signature],
        account: agentAccount
    });
    const txHash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    await proxy.processAuthorizedTrade(intent.pair, intent.amountUsdScaled, "TEST-TRACE-123");

    // 4. Verification: Check Audit Logs
    expect(fs.existsSync(auditLogPath)).to.be.true;
    const logs = fs.readFileSync(auditLogPath, 'utf-8').split('\n').filter(l => l.length > 0);
    const lastLog = JSON.parse(logs[logs.length - 1]);

    expect(lastLog.traceId).to.equal("TEST-TRACE-123");
    expect(lastLog.krakenStatus).to.equal("success");
    expect(lastLog.orderId).to.equal("O12345-67890-ABCDE");
  });
});
