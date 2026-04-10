import { z } from 'zod';

/**
 * @dev Zod schema for ticker data from Kraken CLI.
 */
export const TickerSchema = z.object({
  symbol: z.string(),
  a: z.array(z.string()).length(3), // Ask: [price, whole_lot_volume, lot_volume]
  b: z.array(z.string()).length(3), // Bid: [price, whole_lot_volume, lot_volume]
  c: z.array(z.string()).length(2), // Last trade: [price, lot_volume]
  v: z.array(z.string()).length(2), // Volume: [today, last_24h]
  p: z.array(z.string()).length(2), // Weighted average: [today, last_24h]
  t: z.array(z.number()).length(2), // Trades: [today, last_24h]
  l: z.array(z.string()).length(2), // Low: [today, last_24h]
  h: z.array(z.string()).length(2), // High: [today, last_24h]
  o: z.string(), // Opening price
}).passthrough();

export type Ticker = z.infer<typeof TickerSchema>;

/**
 * @dev Zod schema for account balance.
 */
export const BalanceSchema = z.record(z.string(), z.string().or(z.number()));

export type Balance = z.infer<typeof BalanceSchema>;

/**
 * @dev Zod schema for individual trade history item.
 */
export const TradeItemSchema = z.object({
  ordertxid: z.string(),
  pair: z.string(),
  time: z.number(),
  type: z.enum(['buy', 'sell']),
  ordertype: z.string(),
  price: z.string(),
  cost: z.string(),
  fee: z.string(),
  vol: z.string(),
}).passthrough();

/**
 * @dev Zod schema for trade history.
 */
export const TradeHistorySchema = z.object({
  trades: z.record(z.string(), TradeItemSchema),
  count: z.number(),
}).passthrough();

export type TradeHistory = z.infer<typeof TradeHistorySchema>;

/**
 * @dev Zod schema for order placement parameters.
 */
export const OrderParamsSchema = z.object({
  symbol: z.string(),
  type: z.enum(['market', 'limit']),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().optional(),
});

export type OrderParams = z.infer<typeof OrderParamsSchema>;

/**
 * @dev Zod schema for order results.
 */
export const OrderResultSchema = z.object({
  txid: z.array(z.string()).optional(), // Real trade
  descr: z.object({
      order: z.string()
  }).optional(),
  action: z.string().optional(), // Paper trade
  order_id: z.string().optional(), // Paper trade
  pair: z.string().optional(), // Paper trade
  price: z.number().optional(), // Paper trade
  volume: z.number().optional(), // Paper trade
  cost: z.number().optional(), // Paper trade
}).passthrough();

export type OrderResult = z.infer<typeof OrderResultSchema>;
