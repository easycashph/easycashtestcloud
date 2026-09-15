import { z } from 'zod';

/** Matches the seeded Role rows exactly — see prisma/seed.ts and frontend LmsRole. */
export const LMS_ROLE_NAMES = ['MIS', 'Loan Operation Manager', 'CRM', 'Finance', 'Accounting', 'Collection Officer'] as const;

export const createUserSchema = z.object({
  branchId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roleNames: z.array(z.enum(LMS_ROLE_NAMES)).min(1),
  companyId: z.string().min(1).optional(),
  roleClassId: z.string().uuid().optional(),
});

export type CreateUserRequestBody = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  branchId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  roleNames: z.array(z.enum(LMS_ROLE_NAMES)).min(1).optional(),
  companyId: z.string().min(1).optional(),
  roleClassId: z.string().uuid().nullable().optional(),
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  // 2026-09-15 (user request): MIS may now set/update a member's contact number from the admin
  // Edit Member dialog, not just the member themselves via self-service (PATCH /users/me) -
  // UpdateUserUseCase/IUserRepository already accepted this field, only the API-layer schema
  // rejected it.
  contactNumber: z.string().min(1).nullable().optional(),
});

export type UpdateUserRequestBody = z.infer<typeof updateUserSchema>;

/** `PATCH /users/me` - self-service only. Deliberately excludes email/status/roles/companyId,
 * which stay MIS-controlled via `PATCH /users/:id`. */
export const updateOwnProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  contactNumber: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  birthday: z.coerce.date().nullable().optional(),
});

export type UpdateOwnProfileRequestBody = z.infer<typeof updateOwnProfileSchema>;

/** `POST /users/me/change-password` - requires the current password, unlike the MIS admin reset. */
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export type ChangeOwnPasswordRequestBody = z.infer<typeof changeOwnPasswordSchema>;

/** Settings > Security > Two-Factor Authentication (2026-07-22). */
export const requestTwoFactorSetupSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS']),
});

export type RequestTwoFactorSetupRequestBody = z.infer<typeof requestTwoFactorSetupSchema>;

export const confirmTwoFactorSetupSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(1),
});

export type ConfirmTwoFactorSetupRequestBody = z.infer<typeof confirmTwoFactorSetupSchema>;

export const disableTwoFactorSchema = z.object({
  currentPassword: z.string().min(1),
});

export type DisableTwoFactorRequestBody = z.infer<typeof disableTwoFactorSchema>;
