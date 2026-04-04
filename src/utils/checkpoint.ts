import { createWalletClient, http, keccak256, toHex, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import { CriticalSecurityException } from '../logic/errors.js';
import type { TradeDecision } from '../logic/strategy/risk_assessment.js';
import type { AgentMetadata } from '../logic/config.js';
import fs from 'fs';
import path from 'path';

/**
 * @dev EIP-712 Domain definition for checkpoints.
 * These are local verifiable audit artifacts, not on-chain state changes.
 */
const DOMAIN = {
  name: 'Vertex-Sentinel-Audit',
  version: '1',
  chainId: 11155111, // Sepolia default for hackathon
} as const;

const TYPES = {
  TradeCheckpoint: [
    { name: 'agentId', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'pair', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'amountUsdScaled', type: 'uint256' },
    { name: 'reasoningHash', type: 'bytes32' },
    { name: 'confidenceScaled', type: 'uint256' },
  ],
} as const;

export interface SignedCheckpoint {
  message: any;
  signature: string;
  reasoning: string;
}

/**
 * @dev Creates a cryptographically signed checkpoint of a trade decision.
 * Mandated by Project Review for "Verifiable Execution".
 */
export async function createSignedCheckpoint(
  agent: AgentMetadata,
  decision: TradeDecision,
  privateKey: `0x${string}`
): Promise<SignedCheckpoint> {
  try {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const reasoningHash = keccak256(stringToBytes(decision.reasoning));

    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    });

    const message = {
      agentId: BigInt(agent.agentId),
      timestamp,
      pair: decision.pair,
      action: decision.action,
      amountUsdScaled: decision.amountUsdScaled,
      reasoningHash,
      confidenceScaled: BigInt(Math.round(decision.confidence * 1000)),
    };

    const signature = await client.signTypedData({
      domain: DOMAIN,
      types: TYPES,
      primaryType: 'TradeCheckpoint',
      message,
    });

    const checkpoint: SignedCheckpoint = {
      message: {
        ...message,
        agentId: message.agentId.toString(),
        timestamp: message.timestamp.toString(),
        amountUsdScaled: message.amountUsdScaled.toString(),
        confidenceScaled: message.confidenceScaled.toString(),
      },
      signature,
      reasoning: decision.reasoning,
    };

    // Save to audit log
    const auditLogPath = path.join(process.cwd(), 'logs/audit.json');
    if (!fs.existsSync(path.dirname(auditLogPath))) {
      fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
    }
    fs.appendFileSync(auditLogPath, JSON.stringify(checkpoint) + '\n');

    return checkpoint;

  } catch (error) {
    // Fail-Closed: We don't trade without a signed reason.
    throw new CriticalSecurityException(`Fail-Closed: Checkpoint generation or signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
