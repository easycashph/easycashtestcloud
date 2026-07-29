import type { CollectionHistoryReportRow, DateRangeFilter, IReportingRepository } from '../ports/IReportingRepository';

export class GetCollectionHistoryReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string }): Promise<CollectionHistoryReportRow[]> {
    return this.deps.reportingRepository.getCollectionHistoryReport(filter);
  }
}
