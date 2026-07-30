import { z } from 'zod';

export const updateProductTypeLabelSchema = z.object({
  label: z.string().min(1),
});
