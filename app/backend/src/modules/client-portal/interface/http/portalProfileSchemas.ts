import { z } from 'zod';

/** Phase D (2026-07-24), widened 2026-07-27 (user request, LMS parity) to also cover Personal and
 * Employment - see UpdatePortalProfileInput's own doc comment for exactly which Borrower fields
 * remain staff-editable-only (name, government IDs, dependants, references, etc. - identity/legal
 * fields that shouldn't be self-service). */
export const updatePortalProfileSchema = z.object({
  gender: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  placeOfBirth: z.string().min(1).optional(),
  nationality: z.string().min(1).optional(),
  civilStatus: z.string().min(1).optional(),
  homeOwnership: z.string().min(1).optional(),
  mobilePhone1: z.string().min(1).optional(),
  mobilePhone2: z.string().min(1).optional(),
  email: z.string().email().optional(),
  occupation: z.string().min(1).optional(),
  employer: z.string().min(1).optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  addresses: z
    .array(
      z.object({
        addressType: z.string().min(1).optional(),
        houseUnitNumber: z.string().min(1).optional(),
        street: z.string().min(1).optional(),
        barangay: z.string().min(1).optional(),
        cityMunicipality: z.string().min(1).optional(),
        province: z.string().min(1).optional(),
        zipCode: z.string().min(1).optional(),
        lengthOfStayMonths: z.coerce.number().int().nonnegative().optional(),
        ownershipStatus: z.string().min(1).optional(),
      }),
    )
    .optional(),
});
export type UpdatePortalProfileRequestBody = z.infer<typeof updatePortalProfileSchema>;
