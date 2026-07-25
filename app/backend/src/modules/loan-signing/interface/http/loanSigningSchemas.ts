import { z } from 'zod';

export const createLoanSigningSessionSchema = z.object({
  // 2026-07-25: staff-entered for BOTH parties (same box/UX either way) - a CO_BORROWER batch
  // still needs an existing CoBorrower profile linked to the loan (for the signer's name on the
  // audit trail), but the phone number itself is always whatever staff types into the box, not
  // silently read from that profile - lets staff use a different/updated number per send without
  // first going to edit the CoBorrower record. See CreateLoanSigningSessionUseCase.
  phoneNumber: z.string().min(1),
  partyType: z.enum(['BORROWER', 'CO_BORROWER']).default('BORROWER'),
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
