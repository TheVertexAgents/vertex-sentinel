export interface TradeIntent {
  agentId: bigint;
  agentWallet: string;
  pair: string;
  action: 'BUY' | 'SELL';
  amountUsdScaled: bigint;
  maxSlippageBps: number;
  nonce: bigint;
  deadline: bigint;
}

export interface Authorization {
  isAllowed: boolean;
  reason: string;
  signature: string;
}

export interface RiskAssessment {
  riskScore: number;
  marketRisk: number;
  portfolioRisk: number;
  sentimentRisk: number;
  justification: string;
}

export interface PnLMetrics {
  totalTrades: number;
  winRate: number;
  realizedPnL: number;
  roiPercent: number;
  sentinelSavings: number;
  maxDrawdown: number;
}

export interface SentinelConfig {
  network: 'sepolia' | 'mainnet' | 'local';
  routerAddress: string;
  privateKey: string;
  agentId: number;
}

