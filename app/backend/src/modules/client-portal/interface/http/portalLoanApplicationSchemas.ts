import { z } from 'zod';

/** Core-fields-only subset of loan-application's own createLoanApplicationSchema (Phase 2 design
 * decision, 2026-07-23) - see PortalLoanApplicationDtos.ts's doc comment for why. */
export const submitLoanApplicationSchema = z.object({
  branchId: z.string().min(1),
  applicantName: z.string().min(1),
  birthDate: z.coerce.date().optional(),
  gender: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
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
  coBorrowerName: z.string().min(1).optional(),
  coBorrowerEmployer: z.string().min(1).optional(),
  coBorrowerContactNumber: z.string().min(1).optional(),
  coBorrowerEmail: z.string().email().optional(),
  coBorrowerAddress: z.string().min(1).optional(),
  mobilePhone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  reference1Name: z.string().min(1).optional(),
  reference1Mobile: z.string().min(1).optional(),
  reference2Name: z.string().min(1).optional(),
  reference2Mobile: z.string().min(1).optional(),
  loanPurpose: z.string().min(1).optional(),
  requestedCategory: z.string().min(1),
  requestedAmount: z.coerce.number().positive(),
  requestedTermMonths: z.coerce.number().int().positive(),
});
export type SubmitLoanApplicationRequestBody = z.infer<typeof submitLoanApplicationSchema>;

/** Same category enum as document module's AttachmentDocumentCategory - narrowed here to what's
 * realistic for a client to self-upload at intake (excludes staff-only categories). */
export const portalDocumentCategorySchema = z.enum(['VALID_ID_BORROWER', 'PROOF_OF_BILLING', 'CORPORATE_PAYSLIP']);

export const uploadPortalLoanApplicationDocumentSchema = z.object({
  documentCategory: portalDocumentCategorySchema.optional(),
});
export type UploadPortalLoanApplicationDocumentRequestBody = z.infer<typeof uploadPortalLoanApplicationDocumentSchema>;
