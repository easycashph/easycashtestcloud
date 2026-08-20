import { z } from 'zod';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'must be a non-negative number with at most 2 decimal places');

export const generateStatementOfAccountSchema = z
  .object({
    /**
     * 2026-08-12 (user-confirmed). Defaults to `RECORDED` — take each installment's penalty straight
     * off the repayment schedule, no dates needed. `COMPUTED` keeps those recorded figures and fills
     * in only the installments that have none, over the range below. `MANUAL` takes the figure staff
     * typed, with a required reason.
     */
    penaltyMode: z.enum(['RECORDED', 'COMPUTED', 'MANUAL']).optional().default('RECORDED'),
    /** ISO date (YYYY-MM-DD). Both required under `COMPUTED`, ignored otherwise — the resolver validates. */
    penaltyFromDate: z.string().date().optional(),
    penaltyToDate: z.string().date().optional(),
    /** `COMPUTED` only — see `StatementOfAccountCalculator`'s own doc comment. */
    penaltyRecomputeAll: z.boolean().optional().default(false),
    /** `MANUAL` only. */
    manualPenaltyAmount: decimalString.optional(),
    penaltyManualReason: z.string().trim().min(1).optional(),
    /** ISO date (YYYY-MM-DD) — independent of the Penalty range, also manually entered. */
    accruedInterestAsOfDate: z.string().date(),
    collectionFee: decimalString.optional().default('0.00'),
    otherFee: decimalString.optional().default('0.00'),
  })
  // A hand-set penalty is only defensible alongside the reason for it — rejected here rather than
  // deeper in, so the caller gets a field-level error instead of a generic domain failure.
  .refine((b) => b.penaltyMode !== 'MANUAL' || b.manualPenaltyAmount !== undefined, {
    message: 'A penalty amount is required when setting the penalty manually.',
    path: ['manualPenaltyAmount'],
  })
  .refine((b) => b.penaltyMode !== 'MANUAL' || Boolean(b.penaltyManualReason), {
    message: 'A reason is required when setting the penalty manually.',
    path: ['penaltyManualReason'],
  });

export type GenerateStatementOfAccountRequestBody = z.infer<typeof generateStatementOfAccountSchema>;
