import type { CreateBorrowerAddressInput } from '@modules/borrower/application/dtos/BorrowerDtos';

/**
 * Phase D (2026-07-24 user request), widened 2026-07-27 (user request, LMS parity): Personal,
 * Address, and Employment are self-service editable. Still deliberately excludes name, government
 * IDs, dependants, and references - those stay staff-editable-only.
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
  addresses: {
    addressType: string | null;
    houseUnitNumber: string | null;
    street: string | null;
    barangay: string | null;
    cityMunicipality: string | null;
    province: string | null;
    zipCode: string | null;
  }[];
}
