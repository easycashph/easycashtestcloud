import { z } from 'zod';

/** Phase D (2026-07-24), widened 2026-07-27 (user request, LMS parity) to also cover Personal and
 * Employment, and again 2026-07-31 (user request) to also cover government IDs, Dependants, and
 * Character References - see UpdatePortalProfileInput's own doc comment. */
export const updatePortalProfileSchema = z.object({
  // 2026-07-30 (user request): editable ONLY before the account is linked to a real Borrower -
  // see UpdatePortalProfileUseCase's branch. Once linked, these are silently ignored (name stays
  // staff-editable-only, same posture as before).
  firstName: z.string().min(1).optional(),
  middleName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
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
  occupation: z.string().min(1).optional(),
  employer: z.string().min(1).optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  officeAddress: z.string().min(1).optional(),
  tinNumber: z.string().min(1).optional(),
  sssNumber: z.string().min(1).optional(),
  dependants: z.array(z.object({ name: z.string().min(1), age: z.string().optional(), relationship: z.string().optional() })).optional(),
  reference1Name: z.string().optional(),
  reference1Mobile: z.string().optional(),
  reference2Name: z.string().optional(),
  reference2Mobile: z.string().optional(),
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
