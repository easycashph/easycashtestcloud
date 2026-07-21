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
  coBorrowerContactNumber: z.string().min(1).optional(),
  coBorrowerEmail: z.string().min(1).optional(),
  coBorrowerAddress: z.string().min(1).optional(),
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

/** 2026-07-16 (Under Review / Pre Approval stages) — PATCH semantics, send only what changed.
 * `checkedDocuments` always replaces (the caller sends the full current checklist state, same
 * convention as updateLoanApplicationSchema's `propertiesOwned`). */
const creditBureauPartyCheckSchema = z.object({
  cmap: z.string().optional(),
  kyc: z.string().optional(),
  myscore: z.string().optional(),
});

const mitigationDetailsSchema = z.object({
  bank: z.string().optional(),
  branch: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  atmCardNumber: z.string().optional(),
  allotmentAmount: z.string().optional(),
});

const agencyVerificationDetailsSchema = z.object({
  agencyName: z.string().optional(),
  agencyAddress: z.string().optional(),
  agencyContactNumbers: z.string().optional(),
  yearsWithAgency: z.string().optional(),
  basicMonthlySalary: z.string().optional(),
  position: z.string().optional(),
  vessel: z.string().optional(),
  contractDuration: z.string().optional(),
  joiningPort: z.string().optional(),
  dateOfDeparture: z.string().optional(),
  departureStatus: z.string().optional(),
  expectedSignOffDate: z.string().optional(),
  monthlySalary: z.string().optional(),
  allottee1Name: z.string().optional(),
  allottee1Bank: z.string().optional(),
  allottee1AccountNumber: z.string().optional(),
  allottee1Amount: z.string().optional(),
  allottee2Name: z.string().optional(),
  allottee2Bank: z.string().optional(),
  allottee2AccountNumber: z.string().optional(),
  allottee2Amount: z.string().optional(),
  payrollSchedule: z.string().optional(),
  firstFullAllotmentDate: z.string().optional(),
  cashAdvance: z.string().optional(),
  mannerOfDeduction: z.string().optional(),
  sourceName: z.string().optional(),
  sourcePosition: z.string().optional(),
});

const documentVerificationEntrySchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  reason: z.string().optional(),
});

/** 2026-07-21 — redesigned against the legacy Credit Evaluation Report (CER) template; see
 * `LoanApplication.ts`'s `ReviewReport` doc comment for what replaced what. */
export const reviewReportSchema = z.object({
  ciNotes: z.string().optional(),
  creditBureauResult: z.enum(['CLEAR', 'FLAGGED', 'NO_RECORD_FOUND']).optional(),
  creditBureauScore: z.string().optional(),
  checkedDocuments: z.array(z.string()).optional(),
  documentVerifications: z.record(z.string(), documentVerificationEntrySchema).optional(),
  creditBureauBorrower: creditBureauPartyCheckSchema.optional(),
  creditBureauCoBorrower: creditBureauPartyCheckSchema.optional(),
  mitigation: mitigationDetailsSchema.optional(),
  agencyVerification: agencyVerificationDetailsSchema.optional(),
  conditionsForApproval: z.string().optional(),
  crmRecommendation: z.string().optional(),
});

export type ReviewReportRequestBody = z.infer<typeof reviewReportSchema>;

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
