import { z } from 'zod';

export const updateDocumentTemplateRequiredSchema = z.object({
  isRequired: z.boolean(),
});
export type UpdateDocumentTemplateRequiredRequestBody = z.infer<typeof updateDocumentTemplateRequiredSchema>;

export const setDocumentTemplateProductMappingsSchema = z.object({
  loanProductIds: z.array(z.string().min(1)),
});
export type SetDocumentTemplateProductMappingsRequestBody = z.infer<typeof setDocumentTemplateProductMappingsSchema>;

export const updateDocumentTemplateSignatureRequirementsSchema = z.object({
  requiresBorrowerSignature: z.boolean(),
  requiresCoBorrowerSignature: z.boolean(),
});
export type UpdateDocumentTemplateSignatureRequirementsRequestBody = z.infer<typeof updateDocumentTemplateSignatureRequirementsSchema>;
