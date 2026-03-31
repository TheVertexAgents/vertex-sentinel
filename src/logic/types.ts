/**
 * @title TradeIntent
 * @dev matches the EIP-712 TradeIntent typehash in RiskRouter.sol
 */
export interface TradeIntent {
  agentId: string;
  pair: string;
  volume: bigint;
  maxPrice: bigint;
  deadline: bigint;
}

export interface Authorization {
  isAllowed: boolean;
  reason: string;
  signature?: `0x${string}`;
}

export interface ValidationArtifact {
    intentHash: `0x${string}`;
    timestamp: number;
    status: 'AUTHORIZED' | 'REJECTED';
}
