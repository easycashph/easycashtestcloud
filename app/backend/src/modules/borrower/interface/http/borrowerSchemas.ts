import { z } from 'zod';

/**
 * Zod validates request SHAPE/TYPE only — business validation (e.g. "first
 * name must not be blank after trimming") stays in the domain layer
 * (PersonName.of()), per the existing convention set by authSchemas.ts.
 */
export const createBorrowerSchema = z.object({
  branchId: z.string().min(1),
  assignedLoanOfficerId: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  civilStatus: z.string().min(1).optional(),
  mobilePhone1: z.string().min(1).optional(),
  mobilePhone2: z.string().min(1).optional(),
  email: z.string().email().optional(),
  legacyId: z.string().min(1).optional(),
});

export type CreateBorrowerRequestBody = z.infer<typeof createBorrowerSchema>;

export const createCoBorrowerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  phoneNumber: z.string().min(1).optional(),
  emailAddress: z.string().email().optional(),
  relationship: z.string().min(1).optional(),
  legacyId: z.string().min(1).optional(),
});

export type CreateCoBorrowerRequestBody = z.infer<typeof createCoBorrowerSchema>;
