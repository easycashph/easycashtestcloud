import { z } from 'zod';

export const attachmentOwnerTypeSchema = z.enum(['BORROWER', 'LOAN_ACCOUNT', 'LOAN_APPLICATION']);

export const listAttachmentsQuerySchema = z.object({
  ownerType: attachmentOwnerTypeSchema,
  ownerId: z.string().min(1),
});

export const uploadAttachmentBodySchema = z.object({
  ownerType: attachmentOwnerTypeSchema,
  ownerId: z.string().min(1),
});

export type UploadAttachmentRequestBody = z.infer<typeof uploadAttachmentBodySchema>;
