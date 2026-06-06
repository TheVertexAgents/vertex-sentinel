import { ethers } from 'ethers';
import { createPublicClient, http, type Hex, type Address, type Chain } from 'viem';
import { sepolia, mainnet, hardhat } from 'viem/chains';
import {
    TradeIntent,
    Authorization,
    RiskAssessment,
    PnLMetrics,
    SentinelConfig
} from './types.js';
import { FailClosedException } from './errors.js';

export class SentinelClient {
  private config: SentinelConfig;

  constructor(config: SentinelConfig) {
    this.config = config;
  }

  private getChain(): Chain {
    const chainMap: Record<string, Chain> = {
      'mainnet': mainnet,
      'sepolia': sepolia,
      'local': hardhat
    };
    return chainMap[this.config.network] || sepolia;
  }

  /**
   * @dev Signs a trade intent using EIP-712.
   * Aligned with RiskRouter.sol.
   */
  async signIntent(intent: TradeIntent): Promise<string> {
    if (!this.config.privateKey) throw new FailClosedException('Private key missing');

    const domain = {
      name: 'VertexAgents-Sentinel',
      version: '1',
      chainId: this.config.network === 'sepolia' ? 11155111 : (this.config.network === 'mainnet' ? 1 : 31337),
      verifyingContract: this.config.routerAddress
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
        { name: 'deadline', type: 'uint256' }
      ]
    };

    try {
        const wallet = new ethers.Wallet(this.config.privateKey);

        // Ethers.js v6 expects BigInt for uint256 in TypedData
        const formattedIntent = {
          ...intent,
          agentId: BigInt(intent.agentId),
          amountUsdScaled: BigInt(intent.amountUsdScaled),
          maxSlippageBps: BigInt(intent.maxSlippageBps),
          nonce: BigInt(intent.nonce),
          deadline: BigInt(intent.deadline)
        };

        return await wallet.signTypedData(domain, types, formattedIntent);
    } catch (e: any) {
        throw new FailClosedException(`Signing failed: ${e.message}`);
    }
  }

  /**
   * @dev Authorize a trade intent by validating on-chain state and signing.
   */
  async authorize(intent: TradeIntent): Promise<Authorization> {
    try {
        const publicClient = createPublicClient({
            chain: this.getChain(),
            transport: http()
        });

        // 1. Verify Agent Registration & Status on-chain
        const riskParams = await publicClient.readContract({
            address: this.config.routerAddress as Address,
            abi: [{
                name: 'riskParams',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: '', type: 'uint256' }],
                outputs: [
                    { name: 'maxPositionUsdScaled', type: 'uint256' },
                    { name: 'maxDrawdownBps', type: 'uint256' },
                    { name: 'maxTradesPerHour', type: 'uint256' },
                    { name: 'active', type: 'bool' },
                ],
            }],
            functionName: 'riskParams',
            args: [BigInt(this.config.agentId)],
        }) as any;

        if (!riskParams[3]) { // active
            return {
                isAllowed: false,
                reason: `Fail-Closed: Agent #${this.config.agentId} is not active on-chain.`,
                signature: '0x'
            };
        }

        // 2. Sign Intent
        const signature = await this.signIntent(intent);

        return {
            isAllowed: true,
            reason: 'Sentinel: Intent verified and signed.',
            signature
        };
    } catch (e: any) {
        throw new FailClosedException(`Authorization failed: ${e.message}`);
    }
  }

  /**
   * @dev Fetches risk parameters directly from RiskRouter.
   */
  async getOnChainRiskParams(): Promise<any> {
    const publicClient = createPublicClient({
        chain: this.getChain(),
        transport: http()
    });

    return await publicClient.readContract({
        address: this.config.routerAddress as Address,
        abi: [{
            name: 'riskParams',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: '', type: 'uint256' }],
            outputs: [
                { name: 'maxPositionUsdScaled', type: 'uint256' },
                { name: 'maxDrawdownBps', type: 'uint256' },
                { name: 'maxTradesPerHour', type: 'uint256' },
                { name: 'active', type: 'bool' },
            ],
        }],
        functionName: 'riskParams',
        args: [BigInt(this.config.agentId)],
    });
  }

  /**
   * @dev Mocked risk assessment for SDK demonstration.
   */
  async getRiskAssessment(pair: string, amount: number): Promise<RiskAssessment> {
      return {
          riskScore: 0.1,
          marketRisk: 0.05,
          portfolioRisk: 0.02,
          sentimentRisk: 0.03,
          justification: 'SDK: Risk assessment within safe boundaries.'
      };
  }
}
