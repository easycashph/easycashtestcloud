import { z } from 'zod';

/** Phase D (2026-07-24, confirmed scope) - contact info only: mobile number(s), email, and
 * present address. See UpdatePortalProfileInput's own doc comment for why the rest of the
 * Borrower record isn't self-service-editable yet. */
export const updatePortalProfileSchema = z.object({
  mobilePhone1: z.string().min(1).optional(),
  mobilePhone2: z.string().min(1).optional(),
  email: z.string().email().optional(),
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
