/**
 * Mirrors `app/backend`'s `IDashboardRepository.DashboardSummary` / `DashboardPresenter` JSON
 * shape exactly (the presenter is a pass-through - see `apiClient.ts`'s doc comment for why this
 * pilot hand-maintains DTOs instead of generating them). Money fields are decimal strings, never
 * floats on the wire.
 */
export interface DashboardSummary {
  totalActiveLoans: { count: number; outstandingPrincipalBalance: string };
  overdueAccounts: { count: number; atRiskCollectionsBalance: string };
  collectionsThisMonth: { amount: string };
  portfolioByProduct: Array<{
    productId: string;
    productName: string;
    count: number;
    outstandingPrincipalBalance: string;
  }>;
  /** Next 4 months, bottom-up sum of each ACTIVE/ACTIVE_IN_ARREARS loan's own repayment schedule -
   * not adjusted by a collection-realization rate (no real monthly target exists yet to compute
   * one against). */
  collectionsForecast: Array<{
    month: string;
    year: number;
    scheduledAmount: string;
  }>;
}
