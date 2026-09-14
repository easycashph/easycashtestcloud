import type { LicensedRecruitmentAgencyEntry } from '../../../application/ports/ILicensedRecruitmentAgencyRepository';

export function presentLicensedRecruitmentAgency(entry: LicensedRecruitmentAgencyEntry) {
  return {
    id: entry.id,
    name: entry.name,
    address: entry.address,
    contactName: entry.contactName,
    phone: entry.phone,
    licenseNumber: entry.licenseNumber,
    status: entry.status,
  };
}
