import { z } from 'zod';

export const createLoanApplicationSchema = z.object({
  branchId: z.string().min(1), // Overridden by the caller's own branch for a non-global role — see resolveWriteBranchId.
  /** Set only for the "Create Loan Application" (renewal) flow from an existing client's Client
   * Profile page - see schema.prisma's LoanApplication.borrowerId doc comment. */
  borrowerId: z.string().min(1).optional(),
  applicantName: z.string().min(1),
  age: z.coerce.number().int().positive().optional(),
  gender: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  placeOfBirth: z.string().min(1).optional(),
  nationality: z.string().min(1).optional(),
  homeOwnership: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  houseUnitNumber: z.string().min(1).optional(),
  street: z.string().min(1).optional(),
  barangay: z.string().min(1).optional(),
  cityMunicipality: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  zipCode: z.string().min(1).optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  employer: z.string().min(1).optional(),
  occupation: z.string().min(1).optional(),
  officeAddress: z.string().min(1).optional(),
  tinNumber: z.string().min(1).optional(),
  sssNumber: z.string().min(1).optional(),
  propertiesOwned: z.array(z.string()).optional(),
  creditScore: z.coerce.number().int().optional(),
  coBorrowerName: z.string().min(1).optional(),
  coBorrowerEmployer: z.string().min(1).optional(),
  mobilePhone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dependants: z.array(z.object({ name: z.string(), age: z.string().optional(), relationship: z.string().optional() })).optional(),
  reference1Name: z.string().min(1).optional(),
  reference1Mobile: z.string().min(1).optional(),
  reference2Name: z.string().min(1).optional(),
  reference2Mobile: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
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

/** Risk-input fields, editable post-creation on the Detail page's AI Risk Management Summary —
 * moved off the Create form's intake fields (see loanApplicationSchemas' create schema above) now
 * that they're treated as inputs to a future risk-scoring feature rather than officer-encoded
 * at intake. All optional — PATCH semantics, send only what changed. */
export const updateLoanApplicationSchema = z.object({
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  creditScore: z.coerce.number().int().optional(),
  propertiesOwned: z.array(z.string()).optional(),
});

export type UpdateLoanApplicationRequestBody = z.infer<typeof updateLoanApplicationSchema>;
