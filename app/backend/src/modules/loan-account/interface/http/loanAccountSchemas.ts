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
  /** 2026-07-11: optional — omit to auto-generate `{product.code}_{NNNNN}` (see CreateLoanAccountUseCase). */
  loanCode: z.string().min(1).optional(),
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
  /** 2026-07-11 (Create Loan Account origination fees) — each omitted defaults to 0 in the use case. */
  processingFee: decimalStringSchema.optional(),
  advanceInterestFee: decimalStringSchema.optional(),
  outstandingBalancePayoff: decimalStringSchema.optional(),
  docStampFee: decimalStringSchema.optional(),
  accountManagementFee: decimalStringSchema.optional(),
  otherFees: decimalStringSchema.optional(),
  notarialFee: decimalStringSchema.optional(),
  webFee: decimalStringSchema.optional(),
  insuranceFee: decimalStringSchema.optional(),
  legacyId: z.string().min(1).optional(),
});

export type CreateLoanAccountRequestBody = z.infer<typeof createLoanAccountSchema>;

export const rejectLoanSchema = z.object({
  reason: z.string().min(1).optional(),
});

export type RejectLoanRequestBody = z.infer<typeof rejectLoanSchema>;

const manualAllocationSchema = z.object({
  installmentId: z.string().min(1),
  principal: decimalStringSchema,
  interest: decimalStringSchema,
  penalty: decimalStringSchema,
  fees: decimalStringSchema,
});

/** Milestone 9.1/9.2 CP13: POST /loan-accounts/:id/payments request body. */
export const processPaymentSchema = z.object({
  paymentAmount: decimalStringSchema,
  /** Defaults to "now" in the use case if omitted — see ProcessPaymentUseCase's own default parameter. */
  paidAt: z.coerce.date().optional(),
  /**
   * 2026-07-10 (Payment Recording "Manual" tab): when present, overrides the
   * automatic fees->penalty->interest->principal split with an exact,
   * staff-entered per-installment breakdown — see
   * `ProcessPaymentUseCase.toManualAllocations` for validation rules.
   */
  allocations: z.array(manualAllocationSchema).optional(),
  /**
   * 2026-07-11: Official Receipt number, matching the SDevTech system's own
   * OR#/AR# fields. No longer required (2026-07-11 follow-up, user
   * request) — OR# isn't always issued yet at the time of payment; AR# may
   * be the only receipt number available then, with OR# added later.
   */
  orNumber: z.string().min(1).optional(),
  /** Acknowledgment Receipt number — optional; not every payment channel issues one. */
  arNumber: z.string().min(1).optional(),
});

export type ProcessPaymentRequestBody = z.infer<typeof processPaymentSchema>;

/**
 * 2026-07-11 (Reverse Payment feature, user request): POST
 * /loan-accounts/:id/transactions/:transactionId/reverse request body. `reason` is required
 * (not `.optional()`, unlike `rejectLoanSchema.reason` above) — a mandatory audit trail for a
 * financially consequential, irreversible-in-the-other-direction action, per explicit user
 * decision when this feature was designed.
 */
export const reversePaymentSchema = z.object({
  reason: z.string().min(1),
});

export type ReversePaymentRequestBody = z.infer<typeof reversePaymentSchema>;
