import type { IReportingRepository, ListReportTransactionsOptions, TransactionReportRow } from '../ports/IReportingRepository';

export class ListReportTransactionsUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  async execute(options: ListReportTransactionsOptions): Promise<TransactionReportRow[]> {
    return this.deps.reportingRepository.listTransactions(options);
  }
}
