import { z } from 'zod';

/**
 * @dev Zod schema for ticker data from Kraken (via CCXT).
 */
export const TickerSchema = z.object({
  symbol: z.string(),
  last: z.number().nullable(),
  bid: z.number().nullable(),
  ask: z.number().nullable(),
  timestamp: z.number(),
  datetime: z.string(),
});

export type Ticker = z.infer<typeof TickerSchema>;

/**
 * @dev Zod schema for account balance.
 */
export const BalanceSchema = z.record(z.string(), z.number());

export type Balance = z.infer<typeof BalanceSchema>;

/**
 * @dev Zod schema for order placement parameters.
 */
export const OrderParamsSchema = z.object({
  symbol: z.string(),
  type: z.enum(['market', 'limit']),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().optional().nullable(),
});

export type OrderParams = z.infer<typeof OrderParamsSchema>;

/**
 * @dev Zod schema for order results.
 */
export const OrderResultSchema = z.object({
  id: z.string(),
  clientOrderId: z.string().optional(),
  timestamp: z.number(),
  datetime: z.string(),
  symbol: z.string(),
  type: z.string(),
  side: z.string(),
  amount: z.number(),
  price: z.number(),
  cost: z.number(),
  status: z.string(),
});

export type OrderResult = z.infer<typeof OrderResultSchema>;
