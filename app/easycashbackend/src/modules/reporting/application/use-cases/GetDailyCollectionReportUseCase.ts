import type { DailyCollectionReportRow, DateRangeFilter, IReportingRepository } from '../ports/IReportingRepository';

export class GetDailyCollectionReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string; type?: string }): Promise<DailyCollectionReportRow[]> {
    return this.deps.reportingRepository.getDailyCollectionReport(filter);
  }
}
