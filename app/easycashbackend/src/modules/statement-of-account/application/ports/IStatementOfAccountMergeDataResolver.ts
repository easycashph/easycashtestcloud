import type { Money } from '@shared/domain/Money';
import type { StatementOfAccountFigures } from '../services/StatementOfAccountCalculator';

export interface StatementOfAccountResolveResult {
  /** Flat placeholder map for `IDocumentFiller.fill('SOA', ...)` — see `docs/Architecture/ADR-052-statement-of-account-generation.md` §Placeholders for the full list. */
  mergeData: Record<string, unknown>;
  /** The computed figures, unrounded/untouched by display formatting — persisted verbatim onto `GeneratedStatementOfAccount` (the immutable snapshot). */
  figures: StatementOfAccountFigures;
  /**
   * 2026-07-28 (ADR-052 addendum): the actual `penaltyFromDate` used for this generation, echoed
   * back for persistence. For a prospective loan (live-computed penalty), staff no longer enters
   * this — it's auto-derived here as the earliest qualifying Past Due installment's own due date
   * (display/record purposes only, not fed into the live computation itself, which derives each
   * installment's due date automatically). For a migrated loan, this is simply the caller-supplied
   * `penaltyFromDate` echoed back unchanged.
   */
  effectivePenaltyFromDate: Date;
}

export interface IStatementOfAccountMergeDataResolver {
  resolve(
    loanAccountId: string,
    soaNumber: string,
    statementDate: Date,
    /** Required for a migrated loan (no live penalty on file); ignored for a prospective loan. */
    penaltyFromDate: Date | undefined,
    penaltyToDate: Date,
    accruedInterestAsOfDate: Date,
    collectionFee: Money,
    otherFee: Money,
  ): Promise<StatementOfAccountResolveResult>;
}
