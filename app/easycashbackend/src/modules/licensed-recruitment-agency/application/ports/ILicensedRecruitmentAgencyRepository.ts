export interface LicensedRecruitmentAgencyEntry {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  licenseNumber: string | null;
  status: string;
}

export interface ILicensedRecruitmentAgencyRepository {
  /** Case-insensitive name search, capped at `limit` - this table has ~3,800 rows (see the Prisma
   * model's own doc comment), too many to ever return unpaginated the way InterestRateChart does. */
  search(query: string, limit: number): Promise<LicensedRecruitmentAgencyEntry[]>;
}
