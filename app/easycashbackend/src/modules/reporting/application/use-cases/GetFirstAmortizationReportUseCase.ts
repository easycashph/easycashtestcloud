import type { DateRangeFilter, FirstAmortizationReportRow, IReportingRepository } from '../ports/IReportingRepository';

export class GetFirstAmortizationReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string }): Promise<FirstAmortizationReportRow[]> {
    return this.deps.reportingRepository.getFirstAmortizationReport(filter);
  }
}
