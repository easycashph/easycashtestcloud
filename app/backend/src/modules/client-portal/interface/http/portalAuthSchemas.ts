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
  verificationChannel: z.enum(['EMAIL', 'SMS']).optional(),
});
export type PortalSignUpRequestBody = z.infer<typeof portalSignUpSchema>;

export const portalVerifySignUpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(1),
});
export type PortalVerifySignUpRequestBody = z.infer<typeof portalVerifySignUpSchema>;

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
});
export type PortalLoginRequestBody = z.infer<typeof portalLoginSchema>;

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
