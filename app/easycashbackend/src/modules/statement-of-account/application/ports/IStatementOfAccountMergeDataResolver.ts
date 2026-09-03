import type { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
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
  /** Echoed back for persistence, same reason as the two dates above. Always `false` outside `COMPUTED`. */
  effectivePenaltyRecomputeAll: boolean;
  /**
   * 2026-09-03: the rate the Accrued Interest formula actually used — `manualAccruedInterestRate`
   * when the caller supplied one, otherwise the loan's own `contractualInterestRate` (which may
   * itself be absent). Echoed back for persistence, same reasoning as the penalty fields above —
   * a past statement must stay explainable even if the loan's rate later changes.
   */
  effectiveAccruedInterestRate: Percentage | undefined;
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
    /** `COMPUTED` only — see `StatementOfAccountCalculator`'s own doc comment. */
    penaltyRecomputeAll: boolean,
    /** Required under `MANUAL`; ignored otherwise. */
    manualPenaltyAmount: Money | undefined,
    accruedInterestAsOfDate: Date,
    collectionFee: Money,
    otherFee: Money,
    /** 2026-09-03: optional per-generation override for the Accrued Interest formula's rate —
     * when given, used INSTEAD of the loan account's own `contractualInterestRate`. */
    manualAccruedInterestRate: Percentage | undefined,
  ): Promise<StatementOfAccountResolveResult>;
}
