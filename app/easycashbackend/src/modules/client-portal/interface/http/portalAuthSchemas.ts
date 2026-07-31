import { z } from 'zod';
import { Email } from '@modules/identity/domain/Email';

/** Only a non-empty password here (like identity's loginSchema) - PasswordPolicy.validate() is
 * the actual strength check, applied inside the use case, not this transport-layer schema. */
export const portalSignUpSchema = z.object({
  email: z.string().transform((value, ctx) => {
    const email = Email.create(value);
    if (!email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email address' });
      return z.NEVER;
    }
    return email.value;
  }),
  password: z.string().min(1),
  contactNumber: z.string().min(1).optional(),
});
export type PortalSignUpRequestBody = z.infer<typeof portalSignUpSchema>;

export const portalVerifySignUpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(1),
});
export type PortalVerifySignUpRequestBody = z.infer<typeof portalVerifySignUpSchema>;

/** Signup verification resend (2026-07-30 user request). */
export const portalResendSignUpOtpSchema = z.object({
  challengeId: z.string().min(1),
});
export type PortalResendSignUpOtpRequestBody = z.infer<typeof portalResendSignUpOtpSchema>;

export const portalLoginSchema = z.object({
  email: z.string().transform((value, ctx) => {
    const email = Email.create(value);
    if (!email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email address' });
      return z.NEVER;
    }
    return email.value;
  }),
  password: z.string().min(1),
  /** "Remember this device" (2026-07-30). */
  deviceToken: z.string().min(1).optional(),
});
export type PortalLoginRequestBody = z.infer<typeof portalLoginSchema>;

export const portalVerifyLoginOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(1),
  /** "Remember this device" (2026-07-30). */
  rememberDevice: z.boolean().optional(),
});
export type PortalVerifyLoginOtpRequestBody = z.infer<typeof portalVerifyLoginOtpSchema>;

export const portalResendLoginOtpSchema = z.object({
  challengeId: z.string().min(1),
});
export type PortalResendLoginOtpRequestBody = z.infer<typeof portalResendLoginOtpSchema>;

export const portalRequestPasswordResetSchema = z.object({
  email: z.string().email(),
});
export type PortalRequestPasswordResetRequestBody = z.infer<typeof portalRequestPasswordResetSchema>;

export const portalConfirmPasswordResetSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(1),
  newPassword: z.string().min(1),
});
export type PortalConfirmPasswordResetRequestBody = z.infer<typeof portalConfirmPasswordResetSchema>;
