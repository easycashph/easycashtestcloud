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
  /** Bottom-up: sum of `RepaymentSchedule.principalDue + interestDue` per calendar month, for the
   * next 4 months, across every ACTIVE/ACTIVE_IN_ARREARS loan (branch-scoped like every other
   * field here). Deliberately NOT adjusted by a "collection realization rate" - that would require
   * a real monthly collection *target* to compute against, which doesn't exist as a real,
   * business-confirmed figure yet (see Dashboard's "Collections vs. Target" card, still sample
   * data pending that decision). This is scheduled amounts due, not a probability-weighted
   * prediction. */
  collectionsForecast: Array<{
    month: string;
    year: number;
    scheduledAmount: string;
  }>;
}

export interface IDashboardRepository {
  /** @param branchId Restricts every aggregate to one branch — `undefined` for a global (MIS) caller, which sees every branch. */
  getSummary(branchId: string | undefined): Promise<DashboardSummary>;
}
