import type { DateRangeFilter, FullyPaidAccountsReportRow, IReportingRepository } from '../ports/IReportingRepository';

export class GetFullyPaidAccountsReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string }): Promise<FullyPaidAccountsReportRow[]> {
    return this.deps.reportingRepository.getFullyPaidAccountsReport(filter);
  }
}
