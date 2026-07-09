import type { DateRangeFilter, IReportingRepository, OriginationReportRow, ReportGranularity } from '../ports/IReportingRepository';

export class GetLoanOriginationReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<OriginationReportRow[]> {
    return this.deps.reportingRepository.getLoanOriginationReport(granularity, filter);
  }
}
