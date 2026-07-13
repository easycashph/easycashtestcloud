/** Milestone 9.2: read-only portfolio aggregates for the Dashboard. No domain entity — every
 * field here is a plain aggregate number/string, computed on demand from LoanAccount/
 * LoanTransaction, never stored. */
export interface DashboardSummary {
  totalActiveLoans: {
    count: number;
    outstandingPrincipalBalance: string;
    /**
     * 2026-07-12: no trend. A rolling-30-day reconstruction from `activatedAt`/`closedAt` was
     * tried and rejected — 477 of the 502 legacy `CLOSED` loans have no `closedAt` timestamp (a
     * migration gap), which made every one of them look "still active 30 days ago" and produced a
     * fabricated-looking -26.9% swing. Revisit once/if legacy `closedAt` backfill happens.
     */
  };
  overdueAccounts: {
    count: number;
    atRiskCollectionsBalance: string;
    /** 2026-07-12: no trend — see the field's own migration note in `PrismaDashboardRepository`; a reliable 30-days-ago overdue reconstruction needs per-installment payment timing that pre-`PaymentAllocation` (2026-07-11) payments don't have. */
    /**
     * 2026-07-12: the full id set behind `count`, so the frontend's Portfolio Quality Metrics /
     * Loan Portfolio Health / Recommendation cards can bucket loans by this same live definition
     * instead of the stale `LoanAccount.status === 'ACTIVE_IN_ARREARS'` check they used before —
     * see `DashboardPage.tsx`'s `buildRealPortfolioHealth`.
     */
    loanAccountIds: string[];
    /**
     * 2026-07-12: subset of `loanAccountIds` whose final (highest-`dueDate`) installment has
     * already passed — the loan's whole scheduled term is over and it's still unpaid, the
     * "Matured" segment in `DashboardPage.tsx`'s Loan Portfolio Health Venn diagram (previously
     * always empty — nothing tracked this concept at all). Every other overdue loan (still has an
     * installment due in the future) stays "in arrears".
     */
    maturedLoanAccountIds: string[];
  };
  collectionsThisMonth: {
    amount: string;
    /**
     * 2026-07-12: vs. the SAME number of elapsed days last month (e.g. Jul 1-12 vs Jun 1-12), not
     * last month's full total — comparing a partial month to a completed one made the number swing
     * wildly negative for most of any given month, which read as "collections crashed" when it was
     * really just "the month isn't over yet." Every `LoanTransaction` has a real `entryDate`, so
     * this is accurate for any loan regardless of age. `changePercent` is `null` when the
     * comparison window's total was 0.
     */
    trend: { changePercent: number | null };
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
