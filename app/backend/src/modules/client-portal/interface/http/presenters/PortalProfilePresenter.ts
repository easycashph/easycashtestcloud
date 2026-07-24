import type { Borrower } from '@modules/borrower/domain/Borrower';

/**
 * Phase D (2026-07-24 user request): the client can VIEW their whole profile as the LMS has it,
 * but may only EDIT the contact-info subset (see updatePortalProfileSchema) - viewing the rest
 * (name, employment, government IDs, etc.) is read-only context, not editable via this endpoint.
 */
export interface PortalProfileDto {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  gender: string | null;
  civilStatus: string | null;
  mobilePhone1: string | null;
  mobilePhone2: string | null;
  email: string | null;
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
    civilStatus: borrower.civilStatus ?? null,
    mobilePhone1: borrower.mobilePhone1 ?? null,
    mobilePhone2: borrower.mobilePhone2 ?? null,
    email: borrower.email ?? null,
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
