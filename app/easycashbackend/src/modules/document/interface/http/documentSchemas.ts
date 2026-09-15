import { z } from 'zod';

// 2026-09-15 (user request: staff "View" access to a client's Portal profile photo) - PORTAL_ACCOUNT
// itself was added to the Prisma AttachmentOwnerType enum back on 2026-09-14 for the portal's own
// profile-photo upload, but never added HERE, so staff's generic GET /attachments (and its
// download endpoint) couldn't query it - this was the missing piece, not a new capability.
export const attachmentOwnerTypeSchema = z.enum(['BORROWER', 'LOAN_ACCOUNT', 'LOAN_APPLICATION', 'PORTAL_ACCOUNT']);

export const attachmentDocumentCategorySchema = z.enum([
  'PROFILE_PICTURE',
  'VALID_ID_BORROWER',
  'VALID_ID_CO_BORROWER',
  'PROOF_OF_BILLING',
  'EMPLOYEE_ID',
  'BUSINESS_CLEARANCE',
  'CORPORATE_PAYSLIP',
  'SEAMANS_BOOK',
  'OVERSEAS_EMPLOYMENT_CERTIFICATE',
  'DTI_SEC_REGISTRATION',
  'BUSINESS_PERMIT',
  'INCOME_TAX_RETURN',
  'BANK_STATEMENT',
  'CERTIFICATE_OF_EMPLOYMENT',
  'POEA_CONTRACT',
  'ALLOTMENT_SLIP',
  'FLIGHT_DETAILS',
  'PASSPORT_ID',
  'OTHER_SUPPORTING_DOCUMENT',
]);

export const listAttachmentsQuerySchema = z.object({
  ownerType: attachmentOwnerTypeSchema,
  ownerId: z.string().min(1),
});

export const uploadAttachmentBodySchema = z.object({
  ownerType: attachmentOwnerTypeSchema,
  ownerId: z.string().min(1),
  documentCategory: attachmentDocumentCategorySchema.optional(),
});

export type UploadAttachmentRequestBody = z.infer<typeof uploadAttachmentBodySchema>;
