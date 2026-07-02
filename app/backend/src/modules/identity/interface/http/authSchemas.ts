import { z } from 'zod';

/**
 * Login only requires a non-empty password, NOT PasswordPolicy compliance
 * — an existing account's password may predate a later policy change;
 * PasswordPolicy applies at password-creation time only (bootstrap script
 * today; a future "create user"/"change password" flow later).
 */
export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginRequestBody = z.infer<typeof loginSchema>;
