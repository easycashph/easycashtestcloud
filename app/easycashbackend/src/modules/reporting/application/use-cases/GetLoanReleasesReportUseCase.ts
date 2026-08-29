import type { DateRangeFilter, IReportingRepository, LoanReleaseOrigin, LoanReleaseReportRow } from '../ports/IReportingRepository';

export class GetLoanReleasesReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string; origins?: LoanReleaseOrigin[] }): Promise<LoanReleaseReportRow[]> {
    return this.deps.reportingRepository.getLoanReleasesReport(filter);
  }
}
