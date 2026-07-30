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
