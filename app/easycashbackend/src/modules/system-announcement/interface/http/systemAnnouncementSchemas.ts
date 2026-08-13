import { z } from 'zod';

const typeSchema = z.enum(['MAINTENANCE', 'NEWS', 'GENERAL']);

export const createSystemAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  type: typeSchema,
  showOnLms: z.boolean(),
  showOnPortal: z.boolean(),
  /** ISO datetime string, or omitted/null for "no expiry". */
  expiresAt: z.string().datetime().nullish(),
});
export type CreateSystemAnnouncementRequestBody = z.infer<typeof createSystemAnnouncementSchema>;

export const updateSystemAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(2000).optional(),
  type: typeSchema.optional(),
  showOnLms: z.boolean().optional(),
  showOnPortal: z.boolean().optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().datetime().nullish(),
});
export type UpdateSystemAnnouncementRequestBody = z.infer<typeof updateSystemAnnouncementSchema>;
