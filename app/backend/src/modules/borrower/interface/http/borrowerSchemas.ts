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

/** Mirrors the domain `AddressProps` shape exactly — no field-level validation beyond structural typing, same rationale as the domain value object (no documented format rule to enforce). */
export const addressSchema = z.object({
  addressType: z.string().min(1).optional(),
  houseUnitNumber: z.string().min(1).optional(),
  street: z.string().min(1).optional(),
  barangay: z.string().min(1).optional(),
  cityMunicipality: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  zipCode: z.string().min(1).optional(),
  lengthOfStayMonths: z.number().int().nonnegative().optional(),
  ownershipStatus: z.string().min(1).optional(),
});

/** All fields optional — PATCH semantics, send only what changed. `addresses`, when present, replaces the borrower's whole address list wholesale (matches the domain's "always replaced as a whole" contract — see Address VO doc comment). */
export const updateBorrowerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  mobilePhone1: z.string().min(1).optional(),
  mobilePhone2: z.string().min(1).optional(),
  email: z.string().email().optional(),
  addresses: z.array(addressSchema).optional(),
});

export type UpdateBorrowerRequestBody = z.infer<typeof updateBorrowerSchema>;

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
