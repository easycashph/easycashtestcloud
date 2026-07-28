import { z } from 'zod';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'must be a non-negative number with at most 2 decimal places');

export const generateStatementOfAccountSchema = z.object({
  /**
   * ISO date (YYYY-MM-DD) — manually entered by staff (2026-07-19, user request). 2026-07-28: only
   * required for a migrated loan (no live penalty on file); the resolver validates presence and
   * throws a clear error if a migrated loan's request omits it. Ignored entirely for a prospective
   * loan, whose Penalty line is live-computed instead.
   */
  penaltyFromDate: z.string().date().optional(),
  penaltyToDate: z.string().date(),
  /** ISO date (YYYY-MM-DD) — independent of the Penalty range, also manually entered. */
  accruedInterestAsOfDate: z.string().date(),
  collectionFee: decimalString.optional().default('0.00'),
  otherFee: decimalString.optional().default('0.00'),
});

export type GenerateStatementOfAccountRequestBody = z.infer<typeof generateStatementOfAccountSchema>;
