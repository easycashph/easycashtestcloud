import type { CreateBorrowerAddressInput } from '@modules/borrower/application/dtos/BorrowerDtos';

/**
 * Phase D (2026-07-24 user request), widened 2026-07-27 (user request, LMS parity): Personal,
 * Address, and Employment are self-service editable. Still deliberately excludes name, government
 * IDs, dependants, and references - those stay staff-editable-only.
 */
export interface UpdatePortalProfileInput {
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
