import type { CicMonthlyReportData, CicMonthlyReportFilter, IReportingRepository } from '../ports/IReportingRepository';

export class GetCicMonthlyReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: CicMonthlyReportFilter): Promise<CicMonthlyReportData> {
    return this.deps.reportingRepository.getCicMonthlyReportData(filter);
  }
}
