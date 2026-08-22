import type { IReportingRepository, PortalAccountReportRow } from '../ports/IReportingRepository';

export class GetPortalAccountsReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: { search?: string; status?: string }): Promise<PortalAccountReportRow[]> {
    return this.deps.reportingRepository.getPortalAccountsReport(filter);
  }
}
