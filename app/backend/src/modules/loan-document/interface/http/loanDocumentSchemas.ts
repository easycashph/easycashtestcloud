import { z } from 'zod';

export const generateLoanDocumentSchema = z.object({
  documentTemplateCode: z.string().min(1),
});

export type GenerateLoanDocumentRequestBody = z.infer<typeof generateLoanDocumentSchema>;
