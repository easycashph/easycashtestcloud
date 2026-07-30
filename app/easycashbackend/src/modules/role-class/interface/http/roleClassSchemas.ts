import { z } from 'zod';

export const createRoleClassSchema = z.object({
  roleId: z.string().uuid(),
  name: z.string().min(1),
});

export const updateRoleClassSchema = z
  .object({
    name: z.string().min(1).optional(),
    roleId: z.string().uuid().optional(),
  })
  .refine((body) => body.name !== undefined || body.roleId !== undefined, {
    message: 'At least one of name or roleId is required.',
  });
