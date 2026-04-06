export interface PnLTrackerConfig {
  makerFeePercent?: number;    // Default: 0.16
  takerFeePercent?: number;    // Default: 0.26
  exchangeName?: string;       // Default: "kraken"
}

export interface Trade {
  id: string | number;
  pair: string;
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  timestamp: string;
  fee?: number;
  realizedPnL?: number;
}

export interface Position {
  pair: string;
  open: boolean;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  unrealizedPnL: number;
  entryTime: string;
}

export interface PnLMetrics {
  totalTrades: number;
  winRate: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  roiPercent: number;
}

export interface PnLSummary {
  timestamp: string;
  sessionId: string;
  summary: PnLMetrics;
  positions: Record<string, Position>;
  trades: Trade[];
}
