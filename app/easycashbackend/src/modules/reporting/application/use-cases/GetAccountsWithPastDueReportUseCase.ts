import type { AccountsWithPastDueReportRow, DateRangeFilter, IReportingRepository } from '../ports/IReportingRepository';

export class GetAccountsWithPastDueReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(filter: DateRangeFilter & { branchId?: string }): Promise<AccountsWithPastDueReportRow[]> {
    return this.deps.reportingRepository.getAccountsWithPastDueReport(filter);
  }
}
