import { z } from 'zod';

/** Zod validates shape/type only; range validation against the LoanProductVersion (D-3) happens in the use case, not here. */
export const createLoanAccountSchema = z.object({
  loanCode: z.string().min(1),
  borrowerId: z.string().min(1),
  loanProductVersionId: z.string().min(1),
  branchId: z.string().min(1),
  loanOfficerId: z.string().min(1).optional(),
  principalAmount: z.string().min(1),
  interestRate: z.string().min(1),
  addOnInterestRate: z.string().min(1).optional(),
  contractualInterestRate: z.string().min(1).optional(),
  installmentCount: z.coerce.number().int().positive(),
  gracePeriodDays: z.coerce.number().int().min(0).optional(),
  legacyId: z.string().min(1).optional(),
});

export type CreateLoanAccountRequestBody = z.infer<typeof createLoanAccountSchema>;

export const rejectLoanSchema = z.object({
  reason: z.string().min(1).optional(),
});

export type RejectLoanRequestBody = z.infer<typeof rejectLoanSchema>;
