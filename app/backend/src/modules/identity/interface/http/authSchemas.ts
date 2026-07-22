import { z } from 'zod';
import { Email } from '@modules/identity/domain/Email';

/**
 * Login only requires a non-empty password, NOT PasswordPolicy compliance
 * — an existing account's password may predate a later policy change;
 * PasswordPolicy applies at password-creation time only (bootstrap script
 * today; a future "create user"/"change password" flow later).
 *
 * Audit finding H-02: email validation AND normalization both route
 * through the `Email` domain value object — the single source of truth
 * used at every email-accepting boundary (this schema, PrismaUserRepository,
 * bootstrap-admin.ts) — instead of each boundary re-implementing its own
 * (previously inconsistent) trim/lowercase/format logic.
 */
export const loginSchema = z.object({
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

export type LoginRequestBody = z.infer<typeof loginSchema>;

/** Settings > Security > Two-Factor Authentication (2026-07-22). */
export const verifyLoginOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(1),
});

export type VerifyLoginOtpRequestBody = z.infer<typeof verifyLoginOtpSchema>;
