export type ReportGranularity = 'DAILY' | 'MONTHLY' | 'YEARLY';

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface OriginationReportRow {
  /** Bucket start, formatted per granularity: 'YYYY-MM-DD' (daily), 'YYYY-MM' (monthly), 'YYYY' (yearly). */
  period: string;
  loansOriginated: number;
  amountOriginated: string;
}

export interface CollectionReportRow {
  period: string;
  amountCollected: string;
}

export interface TransactionReportRow {
  id: string;
  loanAccountId: string;
  loanCode: string;
  borrowerName: string;
  branchId: string;
  branchName: string;
  type: string;
  amount: string;
  components: { principal: string; interest: string; fees: string; penalty: string };
  entryDate: Date;
  comment: string | null;
}

export interface ListReportTransactionsOptions extends DateRangeFilter {
  branchId?: string;
  type?: string;
  limit: number;
  cursor?: string;
}

export interface IReportingRepository {
  getLoanOriginationReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<OriginationReportRow[]>;
  getCollectionReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<CollectionReportRow[]>;
  listTransactions(options: ListReportTransactionsOptions): Promise<TransactionReportRow[]>;
}
