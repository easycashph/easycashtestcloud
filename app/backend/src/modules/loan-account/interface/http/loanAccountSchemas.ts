import { z } from 'zod';
import { decimalStringSchema } from '@shared/http/decimalValidation';

/**
 * Zod validates shape/type only; range validation against the
 * LoanProductVersion (D-3) happens in the use case, not here. Decimal
 * fields use `decimalStringSchema` (Milestone 8.1 remediation, H-2) so a
 * malformed value (e.g. "abc") is rejected here with a clean 400, rather
 * than reaching `Money.of()`/`Percentage.of()` and throwing an unhandled
 * decimal.js parse error.
 */
export const createLoanAccountSchema = z.object({
  loanCode: z.string().min(1),
  borrowerId: z.string().min(1),
  loanProductVersionId: z.string().min(1),
  branchId: z.string().min(1),
  loanOfficerId: z.string().min(1).optional(),
  principalAmount: decimalStringSchema,
  interestRate: decimalStringSchema,
  addOnInterestRate: decimalStringSchema.optional(),
  contractualInterestRate: decimalStringSchema.optional(),
  installmentCount: z.coerce.number().int().positive(),
  gracePeriodDays: z.coerce.number().int().min(0).optional(),
  /** ADR-045 (Concept 1 — Exact First Repayment Date): required, explicit input, never derived. */
  firstRepaymentDate: z.coerce.date(),
  legacyId: z.string().min(1).optional(),
});

export type CreateLoanAccountRequestBody = z.infer<typeof createLoanAccountSchema>;

export const rejectLoanSchema = z.object({
  reason: z.string().min(1).optional(),
});

export type RejectLoanRequestBody = z.infer<typeof rejectLoanSchema>;
