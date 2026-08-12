import { z } from 'zod';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'must be a non-negative number with at most 2 decimal places');

export const generateStatementOfAccountSchema = z.object({
  /**
   * 2026-08-12 (user-confirmed). Defaults to `RECORDED` — take each installment's penalty straight
   * off the repayment schedule, no dates needed. `COMPUTED` keeps those recorded figures and fills
   * in only the installments that have none, over the range below.
   */
  penaltyMode: z.enum(['RECORDED', 'COMPUTED']).optional().default('RECORDED'),
  /** ISO date (YYYY-MM-DD). Both required under `COMPUTED`, ignored under `RECORDED` — the resolver validates. */
  penaltyFromDate: z.string().date().optional(),
  penaltyToDate: z.string().date().optional(),
  /** ISO date (YYYY-MM-DD) — independent of the Penalty range, also manually entered. */
  accruedInterestAsOfDate: z.string().date(),
  collectionFee: decimalString.optional().default('0.00'),
  otherFee: decimalString.optional().default('0.00'),
});

export type GenerateStatementOfAccountRequestBody = z.infer<typeof generateStatementOfAccountSchema>;
