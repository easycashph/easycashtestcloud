import { z } from 'zod';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'must be a non-negative number with at most 2 decimal places');

export const generateStatementOfAccountSchema = z.object({
  /** ISO dates (YYYY-MM-DD) — manually entered by staff (2026-07-19, user request), no server-side default. Applied as ONE SHARED range across every Past Due installment for the Penalty computation. */
  penaltyFromDate: z.string().date(),
  penaltyToDate: z.string().date(),
  /** ISO date (YYYY-MM-DD) — independent of the Penalty range, also manually entered. */
  accruedInterestAsOfDate: z.string().date(),
  collectionFee: decimalString.optional().default('0.00'),
  otherFee: decimalString.optional().default('0.00'),
});

export type GenerateStatementOfAccountRequestBody = z.infer<typeof generateStatementOfAccountSchema>;
