import type { DateRangeFilter, ExpectedCollectionReportRow, IReportingRepository } from '../ports/IReportingRepository';

export class GetExpectedCollectionReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string }): Promise<ExpectedCollectionReportRow[]> {
    return this.deps.reportingRepository.getExpectedCollectionReport(filter);
  }
}
