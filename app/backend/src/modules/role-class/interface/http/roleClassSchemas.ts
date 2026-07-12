import { z } from 'zod';

export const createRoleClassSchema = z.object({
  roleId: z.string().uuid(),
  name: z.string().min(1),
});

export const updateRoleClassSchema = z.object({
  name: z.string().min(1),
});
