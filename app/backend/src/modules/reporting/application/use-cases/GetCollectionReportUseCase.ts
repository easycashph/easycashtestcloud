import type { CollectionReportRow, DateRangeFilter, IReportingRepository, ReportGranularity } from '../ports/IReportingRepository';

export class GetCollectionReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<CollectionReportRow[]> {
    return this.deps.reportingRepository.getCollectionReport(granularity, filter);
  }
}
