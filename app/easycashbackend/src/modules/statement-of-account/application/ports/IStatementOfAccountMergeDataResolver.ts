import type { Money } from '@shared/domain/Money';
import type { StatementOfAccountFigures } from '../services/StatementOfAccountCalculator';
import type { SoaPenaltyMode } from '../../domain/GeneratedStatementOfAccount';

export interface StatementOfAccountResolveResult {
  /** Flat placeholder map for `IDocumentFiller.fill('SOA', ...)` — see `docs/Architecture/ADR-052-statement-of-account-generation.md` §Placeholders for the full list. */
  mergeData: Record<string, unknown>;
  /** The computed figures, unrounded/untouched by display formatting — persisted verbatim onto `GeneratedStatementOfAccount` (the immutable snapshot). */
  figures: StatementOfAccountFigures;
  /**
   * 2026-08-12: the penalty range actually used, echoed back for persistence — both `null` under
   * `RECORDED` (that mode takes the penalty straight off the repayment schedule and asks staff for
   * no dates), and the caller's own dates under `COMPUTED`.
   */
  effectivePenaltyFromDate: Date | null;
  effectivePenaltyToDate: Date | null;
}

export interface IStatementOfAccountMergeDataResolver {
  resolve(
    loanAccountId: string,
    soaNumber: string,
    statementDate: Date,
    penaltyMode: SoaPenaltyMode,
    /** Both required under `COMPUTED`; ignored under `RECORDED` and `MANUAL`. */
    penaltyFromDate: Date | undefined,
    penaltyToDate: Date | undefined,
    /** Required under `MANUAL`; ignored otherwise. */
    manualPenaltyAmount: Money | undefined,
    accruedInterestAsOfDate: Date,
    collectionFee: Money,
    otherFee: Money,
  ): Promise<StatementOfAccountResolveResult>;
}
