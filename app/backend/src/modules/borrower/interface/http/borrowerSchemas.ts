import { z } from 'zod';

/**
 * Zod validates request SHAPE/TYPE only — business validation (e.g. "first
 * name must not be blank after trimming") stays in the domain layer
 * (PersonName.of()), per the existing convention set by authSchemas.ts.
 */
const incomeDetailSchema = z.object({
  employmentType: z.string().min(1).optional(),
  employerName: z.string().min(1).optional(),
  employerAddress: z.string().min(1).optional(),
  natureOfBusiness: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  yearsEmployed: z.number().int().nonnegative().optional(),
  /** Structural validation only, matching yearsEmployed's own lack of an upper bound — no
   * confirmed business rule that this must be a 0-11 remainder rather than a free-standing count. */
  monthsEmployed: z.number().int().nonnegative().optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
});

/** Mirrors the domain `AddressProps` shape exactly - no field-level validation beyond structural typing, same rationale as the domain value object (no documented format rule to enforce). */
const addressSchema = z.object({
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

const governmentIdSchema = z.object({
  sssNumber: z.string().min(1).optional(),
  tinNumber: z.string().min(1).optional(),
});

const characterReferenceSchema = z.object({
  firstName: z.string().min(1),
  /** Optional - the form that feeds this only captures one "full name" field, not separate first/
   * last, so an unsplittable single-word name is common. Defaults to '' (DB column is NOT NULL but
   * not required to be non-empty) rather than fabricating a value. */
  lastName: z.string().optional(),
  relationship: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
  emailAddress: z.string().email().optional(),
});

const dependantSchema = z.object({
  name: z.string().min(1),
  age: z.string().min(1).optional(),
  relationship: z.string().min(1).optional(),
});

export const createBorrowerSchema = z.object({
  branchId: z.string().min(1),
  assignedLoanOfficerId: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  placeOfBirth: z.string().min(1).optional(),
  nationality: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  homeOwnership: z.string().min(1).optional(),
  mobilePhone1: z.string().min(1).optional(),
  mobilePhone2: z.string().min(1).optional(),
  email: z.string().email().optional(),
  facebookLink: z.string().min(1).optional(),
  dependants: z.array(dependantSchema).optional(),
  note: z.string().min(1).optional(),
  legacyId: z.string().min(1).optional(),
  /** Set by the "Create Client Profile" flow on an APPROVED LoanApplication (Loan Application
   * Detail page) - links the new borrower back to it so the application can't be used to create
   * a duplicate client. Omitted for any other creation path (walk-in, migration, etc). */
  sourceApplicationId: z.string().min(1).optional(),
  incomeDetail: incomeDetailSchema.optional(),
  governmentId: governmentIdSchema.optional(),
  characterReferences: z.array(characterReferenceSchema).optional(),
  addresses: z.array(addressSchema).optional(),
});

export type CreateBorrowerRequestBody = z.infer<typeof createBorrowerSchema>;

/** All fields optional — PATCH semantics, send only what changed. `addresses`, when present, replaces the borrower's whole address list wholesale (matches the domain's "always replaced as a whole" contract — see Address VO doc comment). */
export const updateBorrowerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  mobilePhone1: z.string().min(1).optional(),
  mobilePhone2: z.string().min(1).optional(),
  email: z.string().email().optional(),
  facebookLink: z.string().min(1).optional(),
  addresses: z.array(addressSchema).optional(),
});

export type UpdateBorrowerRequestBody = z.infer<typeof updateBorrowerSchema>;

export const createCoBorrowerSchema = z.object({
  /** 2026-07-16 (ADR-015 resolved: per-Borrower) — see CreateCoBorrowerUseCase's own doc comment. */
  borrowerId: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  phoneNumber: z.string().min(1).optional(),
  emailAddress: z.string().email().optional(),
  relationship: z.string().min(1).optional(),
  employer: z.string().min(1).optional(),
  legacyId: z.string().min(1).optional(),
  addresses: z.array(addressSchema).optional(),
});

export type CreateCoBorrowerRequestBody = z.infer<typeof createCoBorrowerSchema>;

/** All fields optional — PATCH semantics, send only what changed. */
export const updateCoBorrowerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  phoneNumber: z.string().min(1).optional(),
  emailAddress: z.string().email().optional(),
  relationship: z.string().min(1).optional(),
  employer: z.string().min(1).optional(),
  addresses: z.array(addressSchema).optional(),
});

export type UpdateCoBorrowerRequestBody = z.infer<typeof updateCoBorrowerSchema>;
