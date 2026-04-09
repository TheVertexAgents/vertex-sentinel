import { createWalletClient, http, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';
import type { TradeDecision } from '../logic/strategy/risk_assessment.js';
import type { AgentMetadata } from '../logic/config.js';
import fs from 'fs';
import path from 'path';

/**
 * @dev EIP-712 Domain definition for checkpoints.
 * Aligned with template: name changed to 'AITradingAgent'
 */
const getDomain = (registryAddress: string, chainId: number) => ({
  name: 'AITradingAgent',
  version: '1',
  chainId,
  verifyingContract: registryAddress as `0x${string}`,
} as const);

export const CHECKPOINT_TYPES = {
  TradeCheckpoint: [
    { name: 'agentId',           type: 'uint256' },
    { name: 'timestamp',         type: 'uint256' },
    { name: 'action',            type: 'string'  },
    { name: 'asset',             type: 'string'  },
    { name: 'pair',              type: 'string'  },
    { name: 'amountUsdScaled',   type: 'uint256' },
    { name: 'priceUsdScaled',    type: 'uint256' },
    { name: 'reasoningHash',     type: 'bytes32' },
    { name: 'confidenceScaled',  type: 'uint256' },
    { name: 'intentHash',        type: 'bytes32' },
  ],
} as const;

export interface SignedCheckpoint {
  message: any;
  signature: string;
  reasoning: string;
  pnl?: any;
  checkpointHash: string;
}

/**
 * @dev Creates a cryptographically signed checkpoint of a trade decision.
 * Fully aligned with the official template for Leaderboard validation.
 */
export async function createSignedCheckpoint(
  agent: AgentMetadata,
  decision: TradeDecision,
  intentHash: `0x${string}`,
  priceUsd: number,
  registryAddress: string,
  privateKey: `0x${string}`,
  chainId: number = 11155111,
  pnl?: any
): Promise<SignedCheckpoint> {
  try {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const reasoningHash = keccak256(stringToBytes(decision.reasoning));

    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    });

    // Derive asset from pair (e.g., BTC/USDC -> BTC)
    const asset = decision.pair.split('/')[0] || decision.pair;

    const message = {
      agentId: BigInt(agent.agentId),
      timestamp,
      action: decision.action,
      asset,
      pair: decision.pair,
      amountUsdScaled: decision.amountUsdScaled,
      priceUsdScaled: BigInt(Math.round(priceUsd * 100)),
      reasoningHash,
      confidenceScaled: BigInt(Math.round(decision.confidence * 1000)),
      intentHash,
    };

    const signature = await client.signTypedData({
      domain: getDomain(registryAddress, chainId),
      types: CHECKPOINT_TYPES,
      primaryType: 'TradeCheckpoint',
      message,
    });

    // To post to ValidationRegistry, we need the EIP-712 hash
    // In Viem, we can use hashTypedData
    const { hashTypedData } = await import('viem');
    const checkpointHash = hashTypedData({
        domain: getDomain(registryAddress, chainId),
        types: CHECKPOINT_TYPES,
        primaryType: 'TradeCheckpoint',
        message
    });

    const checkpoint: SignedCheckpoint = {
      message: {
        ...message,
        agentId: message.agentId.toString(),
        timestamp: message.timestamp.toString(),
        amountUsdScaled: message.amountUsdScaled.toString(),
        priceUsdScaled: message.priceUsdScaled.toString(),
        confidenceScaled: message.confidenceScaled.toString(),
      },
      signature,
      reasoning: decision.reasoning,
      pnl: pnl,
      checkpointHash
    };

    // Save to audit log
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    if (!fs.existsSync(path.dirname(auditLogPath))) {
      fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
    }
    fs.appendFileSync(auditLogPath, JSON.stringify(checkpoint) + '\n');

    return checkpoint;

  } catch (error) {
    throw new CriticalSecurityException(`Fail-Closed: Checkpoint generation or signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
