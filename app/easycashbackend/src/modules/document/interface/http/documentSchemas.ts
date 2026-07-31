import { z } from 'zod';

export const attachmentOwnerTypeSchema = z.enum(['BORROWER', 'LOAN_ACCOUNT', 'LOAN_APPLICATION']);

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
