import type { AccountsWithPastDueReportRow, IReportingRepository } from '../ports/IReportingRepository';

export class GetAccountsWithPastDueReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: { branchId?: string }): Promise<AccountsWithPastDueReportRow[]> {
    return this.deps.reportingRepository.getAccountsWithPastDueReport(filter);
  }
}
