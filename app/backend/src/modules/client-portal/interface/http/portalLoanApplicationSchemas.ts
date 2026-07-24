import { z } from 'zod';

/** 2026-07-24 (user request): mirrors loan-application's own createLoanApplicationSchema in full,
 * minus what can't apply to a public self-service submission - see
 * PortalLoanApplicationDtos.ts's doc comment for exactly what's excluded and why. */
export const submitLoanApplicationSchema = z.object({
  branchId: z.string().min(1),
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
  previousAddressSameAsPresent: z.boolean().optional(),
  previousAddress: z.string().min(1).optional(),
  previousHouseUnitNumber: z.string().min(1).optional(),
  previousStreet: z.string().min(1).optional(),
  previousBarangay: z.string().min(1).optional(),
  previousCityMunicipality: z.string().min(1).optional(),
  previousProvince: z.string().min(1).optional(),
  previousZipCode: z.string().min(1).optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  employer: z.string().min(1).optional(),
  occupation: z.string().min(1).optional(),
  officeAddress: z.string().min(1).optional(),
  tinNumber: z.string().min(1).optional(),
  sssNumber: z.string().min(1).optional(),
  coBorrowerName: z.string().min(1).optional(),
  coBorrowerEmployer: z.string().min(1).optional(),
  coBorrowerContactNumber: z.string().min(1).optional(),
  coBorrowerEmail: z.string().email().optional(),
  coBorrowerAddress: z.string().min(1).optional(),
  mobilePhone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dependants: z.array(z.object({ name: z.string().min(1), age: z.string().optional(), relationship: z.string().optional() })).optional(),
  reference1Name: z.string().min(1).optional(),
  reference1Mobile: z.string().min(1).optional(),
  reference2Name: z.string().min(1).optional(),
  reference2Mobile: z.string().min(1).optional(),
  note: z.string().max(2000).optional(),
  referralSource: z.string().min(1).optional(),
  accountType: z.enum(['NEW', 'RENEWAL']).optional(),
  loanPurpose: z.string().min(1).optional(),
  requestedCategory: z.string().min(1),
  requestedAmount: z.coerce.number().positive(),
  requestedTermMonths: z.coerce.number().int().positive(),
});
export type SubmitLoanApplicationRequestBody = z.infer<typeof submitLoanApplicationSchema>;

/** Same category enum as document module's AttachmentDocumentCategory, minus PROFILE_PICTURE
 * (no clear self-service use for it - the paper-form-derived slot is meant for a staff photo
 * capture during a walk-in visit, not a client uploading their own). */
export const portalDocumentCategorySchema = z.enum([
  'VALID_ID_BORROWER',
  'VALID_ID_CO_BORROWER',
  'PROOF_OF_BILLING',
  'EMPLOYEE_ID',
  'BUSINESS_CLEARANCE',
  'CORPORATE_PAYSLIP',
  'SEAMANS_BOOK',
  'OVERSEAS_EMPLOYMENT_CERTIFICATE',
]);

export const uploadPortalLoanApplicationDocumentSchema = z.object({
  documentCategory: portalDocumentCategorySchema.optional(),
});
export type UploadPortalLoanApplicationDocumentRequestBody = z.infer<typeof uploadPortalLoanApplicationDocumentSchema>;
