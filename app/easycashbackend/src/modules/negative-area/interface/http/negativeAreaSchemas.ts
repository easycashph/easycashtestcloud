import { z } from 'zod';

export const createNegativeAreaSchema = z.object({
  city: z.string().trim().min(1),
  areaName: z.string().trim().min(1),
});

export type CreateNegativeAreaRequestBody = z.infer<typeof createNegativeAreaSchema>;
