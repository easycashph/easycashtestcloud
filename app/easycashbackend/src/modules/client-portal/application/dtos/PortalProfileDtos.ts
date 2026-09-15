import type { CreateBorrowerAddressInput } from '@modules/borrower/application/dtos/BorrowerDtos';

/**
 * Phase D (2026-07-24 user request), widened 2026-07-27 (user request, LMS parity), and again
 * 2026-07-31 (user request): Personal, Address, Employment, government IDs, Dependants, and
 * Character References are all self-service editable now. Name stays editable only pre-linkage
 * (see UpdatePortalProfileUseCase's own doc comment).
 */
export interface UpdatePortalProfileInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  gender?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  occupation?: string;
  employer?: string;
  monthlyIncome?: number;
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  dependants?: { name: string; age?: string; relationship?: string }[];
  reference1Name?: string;
  reference1Mobile?: string;
  reference2Name?: string;
  reference2Mobile?: string;
  addresses?: CreateBorrowerAddressInput[];
}

/** Read shape for GET/PATCH /portal/profile - same whether it was built from a real Borrower
 * (linked account) or from PortalAccount's own pre-application profile columns (unlinked account,
 * 2026-07-30) - see GetPortalProfileUseCase's two builder functions. */
export interface PortalProfileDto {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  gender: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  civilStatus: string | null;
  homeOwnership: string | null;
  mobilePhone1: string | null;
  mobilePhone2: string | null;
  email: string | null;
  occupation: string | null;
  employer: string | null;
  monthlyIncome: number | null;
  officeAddress: string | null;
  tinNumber: string | null;
  sssNumber: string | null;
  dependants: { name: string; age?: string; relationship?: string }[];
  reference1Name: string | null;
  reference1Mobile: string | null;
  reference2Name: string | null;
  reference2Mobile: string | null;
  addresses: {
    addressType: string | null;
    houseUnitNumber: string | null;
    street: string | null;
    barangay: string | null;
    cityMunicipality: string | null;
    province: string | null;
    zipCode: string | null;
  }[];
  /** 2026-09-14 (user request: "make profile picture mandatory") - whether a photo has been
   * uploaded via `/portal/profile/photo` (PortalAccount-owned, not the LoanApplication-scoped
   * attachment `PortalAvatar.tsx` uses). Lets the frontend gate/dashboard check completeness
   * without a second round trip. */
  hasProfilePhoto: boolean;
}
