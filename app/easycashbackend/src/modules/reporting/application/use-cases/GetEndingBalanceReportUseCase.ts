import type { EndingBalanceReportRow, IReportingRepository } from '../ports/IReportingRepository';

export class GetEndingBalanceReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: { branchId?: string }): Promise<EndingBalanceReportRow[]> {
    return this.deps.reportingRepository.getEndingBalanceReport(filter);
  }
}
