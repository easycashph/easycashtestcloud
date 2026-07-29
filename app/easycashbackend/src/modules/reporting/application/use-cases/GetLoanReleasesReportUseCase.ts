import type { DateRangeFilter, IReportingRepository, LoanReleaseReportRow } from '../ports/IReportingRepository';

export class GetLoanReleasesReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string }): Promise<LoanReleaseReportRow[]> {
    return this.deps.reportingRepository.getLoanReleasesReport(filter);
  }
}
