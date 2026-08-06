import { z } from 'zod';

export const updateRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()),
});
