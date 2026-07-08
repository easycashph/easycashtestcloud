import { z } from 'zod';

export const createLoanApplicationSchema = z.object({
  branchId: z.string().min(1), // Overridden by the caller's own branch for a non-global role — see resolveWriteBranchId.
  applicantName: z.string().min(1),
  age: z.coerce.number().int().positive().optional(),
  address: z.string().min(1).optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  employer: z.string().min(1).optional(),
  propertiesOwned: z.array(z.string()).optional(),
  creditScore: z.coerce.number().int().optional(),
  coBorrowerName: z.string().min(1).optional(),
  referralSource: z.string().min(1).optional(),
  accountType: z.enum(['NEW', 'RENEWAL']).optional(),
  loanPurpose: z.string().min(1).optional(),
  requestedCategory: z.string().min(1),
  requestedAmount: z.coerce.number().positive(),
  requestedTermMonths: z.coerce.number().int().positive(),
  submittedDocuments: z.array(z.string()).optional(),
});

export type CreateLoanApplicationRequestBody = z.infer<typeof createLoanApplicationSchema>;

export const assignLoanApplicationProductSchema = z.object({
  loanProductVersionId: z.string().min(1),
});

export type AssignLoanApplicationProductRequestBody = z.infer<typeof assignLoanApplicationProductSchema>;

export const decideLoanApplicationSchema = z.object({
  decisionNote: z.string().min(1).optional(),
});

export type DecideLoanApplicationRequestBody = z.infer<typeof decideLoanApplicationSchema>;
