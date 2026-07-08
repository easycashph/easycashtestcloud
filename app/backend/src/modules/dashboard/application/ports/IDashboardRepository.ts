/** Milestone 9.2: read-only portfolio aggregates for the Dashboard. No domain entity — every
 * field here is a plain aggregate number/string, computed on demand from LoanAccount/
 * LoanTransaction, never stored. */
export interface DashboardSummary {
  totalActiveLoans: {
    count: number;
    outstandingPrincipalBalance: string;
  };
  overdueAccounts: {
    count: number;
    atRiskCollectionsBalance: string;
  };
  collectionsThisMonth: {
    amount: string;
  };
  portfolioByProduct: Array<{
    productId: string;
    productName: string;
    count: number;
    outstandingPrincipalBalance: string;
  }>;
}

export interface IDashboardRepository {
  /** @param branchId Restricts every aggregate to one branch — `undefined` for a global (MIS) caller, which sees every branch. */
  getSummary(branchId: string | undefined): Promise<DashboardSummary>;
}
