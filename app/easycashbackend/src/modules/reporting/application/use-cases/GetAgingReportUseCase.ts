import type { AgingReportRow, IReportingRepository } from '../ports/IReportingRepository';

export class GetAgingReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: { branchId?: string }): Promise<AgingReportRow[]> {
    return this.deps.reportingRepository.getAgingReport(filter);
  }
}
