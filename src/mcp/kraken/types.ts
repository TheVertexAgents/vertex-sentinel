import { z } from 'zod';

/**
 * @dev Zod schema for ticker data from Kraken CLI.
 * Compatible with both live and paper mode (ticker always uses real market data).
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
 * @dev Zod schemas for account balance — supports BOTH live and paper formats.
 *
 * Live format:  {"ZUSD": "1000.00", "XXBT": "0.01"}
 * Paper format: {"balances": {"BTC": {"available": 0.01, "reserved": 0.0, "total": 0.01}}, "mode": "paper"}
 *
 * The handler in index.ts normalizes paper → flat format before returning to LLM.
 */
const PaperBalanceItemSchema = z.object({
  available: z.number(),
  reserved: z.number(),
  total: z.number(),
}).passthrough();

const PaperBalanceSchema = z.object({
  balances: z.record(z.string(), PaperBalanceItemSchema),
  mode: z.string(),
}).passthrough();

const LiveBalanceSchema = z.record(z.string(), z.string().or(z.number()));

export const BalanceSchema = z.union([PaperBalanceSchema, LiveBalanceSchema]);

export type Balance = z.infer<typeof BalanceSchema>;

/**
 * @dev Zod schema for individual trade history item.
 * Flexible to accept both live and paper field names/types.
 *
 * Live fields:  ordertxid, pair, time (unix), type, ordertype, price (str), cost (str), fee (str), vol (str)
 * Paper fields: id, order_id, pair, time (ISO), side, status, price (num), cost (num), fee (num), volume (num)
 *
 * Using .passthrough() to allow all additional fields through validation.
 */
export const TradeItemSchema = z.object({
  pair: z.string(),
  price: z.union([z.string(), z.number()]),
  cost: z.union([z.string(), z.number()]),
  fee: z.union([z.string(), z.number()]),
}).passthrough();

/**
 * @dev Zod schema for trade history response.
 * Accepts both live (record with txid keys) and paper (array) formats.
 *
 * Live:  {"trades": {"txid1": {...}}, "count": 2}
 * Paper: {"trades": [{...}], "filled_count": 1, "cancelled_count": 0, "mode": "paper"}
 */
export const TradeHistorySchema = z.object({
  trades: z.union([
    z.record(z.string(), TradeItemSchema),  // Live: { "txid": {...} }
    z.array(TradeItemSchema),               // Paper: [{ ... }]
  ]),
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
 * Accepts both live Kraken and paper trading response formats.
 *
 * Live:  {"txid": ["OXXXXX"], "descr": {"order": "buy 0.001 XBTUSD @ market"}}
 * Paper: {"action": "buy", "order_id": "PAPER-00003", "pair": "XBTUSD", "price": 71586.6, "volume": 0.001, "cost": 71.58}
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
