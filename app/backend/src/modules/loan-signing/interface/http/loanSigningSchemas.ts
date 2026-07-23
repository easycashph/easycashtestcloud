import { z } from 'zod';

export const createLoanSigningSessionSchema = z.object({
  phoneNumber: z.string().min(1),
});
export type CreateLoanSigningSessionRequestBody = z.infer<typeof createLoanSigningSessionSchema>;

export const verifySigningOtpSchema = z.object({
  code: z.string().length(6),
});
export type VerifySigningOtpRequestBody = z.infer<typeof verifySigningOtpSchema>;

export const signLoanSigningDocumentSchema = z.object({
  consentChecked: z.boolean(),
  signatureImagePng: z.string().min(1),
});
export type SignLoanSigningDocumentRequestBody = z.infer<typeof signLoanSigningDocumentSchema>;
