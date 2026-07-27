import type { Borrower } from '@modules/borrower/domain/Borrower';

/**
 * Phase D (2026-07-24 user request), widened 2026-07-27 (user request, LMS parity): the client can
 * VIEW and EDIT their Personal, Address, and Employment details (see updatePortalProfileSchema) -
 * name, government IDs, dependants, and references remain read-only, staff-editable-only.
 */
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

export function presentPortalProfile(borrower: Borrower): PortalProfileDto {
  return {
    id: borrower.id,
    firstName: borrower.name.firstName,
    middleName: borrower.name.middleName ?? null,
    lastName: borrower.name.lastName,
    suffix: borrower.suffix ?? null,
    gender: borrower.gender ?? null,
    birthDate: borrower.birthDate ? borrower.birthDate.toISOString().slice(0, 10) : null,
    placeOfBirth: borrower.placeOfBirth ?? null,
    nationality: borrower.nationality ?? null,
    civilStatus: borrower.civilStatus ?? null,
    homeOwnership: borrower.homeOwnership ?? null,
    mobilePhone1: borrower.mobilePhone1 ?? null,
    mobilePhone2: borrower.mobilePhone2 ?? null,
    email: borrower.email ?? null,
    occupation: borrower.incomeDetail?.position ?? null,
    employer: borrower.incomeDetail?.employerName ?? null,
    monthlyIncome: borrower.incomeDetail?.monthlyIncome ?? null,
    addresses: borrower.addresses.map((address) => ({
      addressType: address.addressType ?? null,
      houseUnitNumber: address.houseUnitNumber ?? null,
      street: address.street ?? null,
      barangay: address.barangay ?? null,
      cityMunicipality: address.cityMunicipality ?? null,
      province: address.province ?? null,
      zipCode: address.zipCode ?? null,
    })),
  };
}
