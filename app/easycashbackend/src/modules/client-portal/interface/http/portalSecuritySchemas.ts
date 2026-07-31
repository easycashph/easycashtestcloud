import { z } from 'zod';

export const changePortalPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
export type ChangePortalPasswordRequestBody = z.infer<typeof changePortalPasswordSchema>;

export const changePortalEmailSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string().min(1),
});
export type ChangePortalEmailRequestBody = z.infer<typeof changePortalEmailSchema>;

export const requestEnablePortalTwoFactorSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'BOTH']),
});
export type RequestEnablePortalTwoFactorRequestBody = z.infer<typeof requestEnablePortalTwoFactorSchema>;

export const confirmEnablePortalTwoFactorSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(1),
});
export type ConfirmEnablePortalTwoFactorRequestBody = z.infer<typeof confirmEnablePortalTwoFactorSchema>;

export const disablePortalTwoFactorSchema = z.object({
  currentPassword: z.string().min(1),
});
export type DisablePortalTwoFactorRequestBody = z.infer<typeof disablePortalTwoFactorSchema>;
