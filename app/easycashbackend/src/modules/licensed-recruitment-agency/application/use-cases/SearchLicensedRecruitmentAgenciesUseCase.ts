import type {
  ILicensedRecruitmentAgencyRepository,
  LicensedRecruitmentAgencyEntry,
} from '../ports/ILicensedRecruitmentAgencyRepository';

export interface SearchLicensedRecruitmentAgenciesUseCaseDeps {
  licensedRecruitmentAgencyRepository: ILicensedRecruitmentAgencyRepository;
}

const RESULT_LIMIT = 20;

export class SearchLicensedRecruitmentAgenciesUseCase {
  constructor(private readonly deps: SearchLicensedRecruitmentAgenciesUseCaseDeps) {}

  async execute(query: string): Promise<LicensedRecruitmentAgencyEntry[]> {
    const trimmed = query.trim();
    // 2026-09-14 (Agency name dropdown, user request): an empty/too-short query against ~3,800
    // rows would just return an arbitrary 20-row slice - not useful for a type-ahead combobox, so
    // require at least 2 characters before hitting the DB at all.
    if (trimmed.length < 2) return [];
    return this.deps.licensedRecruitmentAgencyRepository.search(trimmed, RESULT_LIMIT);
  }
}
