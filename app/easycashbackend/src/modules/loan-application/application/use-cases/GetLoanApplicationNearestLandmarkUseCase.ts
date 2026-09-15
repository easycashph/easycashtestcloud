import { NotFoundError } from '@shared/errors/DomainError';
import type { IGeocodingService } from '@shared/geo/IGeocodingService';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface GetLoanApplicationNearestLandmarkUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  geocodingService: IGeocodingService;
}

/** 2026-09-15 (user request: "nearest landmark" next to the applicant's submission coordinates on
 * the Applicant Details page) - resolved live/on-demand rather than stored on the application,
 * since it's a display convenience for staff, not a business rule the pre-qualification flow
 * depends on (unlike the existing `distanceFromBranchKm` geocoding, which IS cached at submission
 * time because it feeds PREAPPROVED/PREDECLINED). Reuses the same Nominatim service, so this stays
 * free/open-source (CLAUDE.md) with no new API key. Returns `null` (never throws) when there's no
 * captured location for this application or the reverse-geocode itself fails/finds nothing. */
export class GetLoanApplicationNearestLandmarkUseCase {
  constructor(private readonly deps: GetLoanApplicationNearestLandmarkUseCaseDeps) {}

  async execute(id: string): Promise<string | null> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }
    const { submissionLatitude, submissionLongitude } = application.toProps();
    if (submissionLatitude == null || submissionLongitude == null) return null;
    return this.deps.geocodingService.reverseGeocode(submissionLatitude, submissionLongitude);
  }
}
