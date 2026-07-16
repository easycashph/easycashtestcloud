import type { RepaymentInstallment } from '../../../domain/RepaymentInstallment';
import type { InstallmentAmounts } from '../../../domain/valueObjects/InstallmentAmounts';
import { resolveComputedPenalty, type PenaltyComputationContext } from '../../../domain/CurrentPenaltyResolver';

export type { PenaltyComputationContext } from '../../../domain/CurrentPenaltyResolver';

/** Milestone 8 / D-5: the only place RepaymentInstallment becomes JSON-safe — Money/Date formatting never happens in the controller. */
function presentAmounts(amounts: InstallmentAmounts) {
  return {
    principal: amounts.principal.toString(),
    interest: amounts.interest.toString(),
    fees: amounts.fees.toString(),
    penalty: amounts.penalty.toString(),
    total: amounts.total().toString(),
  };
}

export function presentRepaymentInstallment(installment: RepaymentInstallment, penaltyContext?: PenaltyComputationContext) {
  const isLive = Boolean(penaltyContext?.isProspectiveLoan && installment.status !== 'PAID');
  const override = installment.penaltyOverride;

  let currentPenaltyOwed: string | null;
  if (override) {
    currentPenaltyOwed = override.amount.toString();
  } else if (isLive) {
    currentPenaltyOwed = resolveComputedPenalty(installment, penaltyContext).toString();
  } else {
    currentPenaltyOwed = null;
  }

  return {
    id: installment.id,
    loanAccountId: installment.loanAccountId,
    installmentNumber: installment.installmentNumber,
    dueDate: installment.dueDate.toISOString(),
    due: presentAmounts(installment.due),
    paid: presentAmounts(installment.paid),
    // Derived (REPAY-3), never independently stored — see RepaymentInstallment.status.
    status: installment.status,
    lastPaidAt: installment.lastPaidAt?.toISOString() ?? null,
    legacyId: installment.legacyId ?? null,
    createdAt: installment.createdAt.toISOString(),
    updatedAt: installment.updatedAt.toISOString(),
    /**
     * Live-computed "as of today" penalty (`ADR-050`), OR the frozen manual override amount if one
     * is set (2026-07-15, Reduce Penalty feature — an override always wins over live computation,
     * see `RepaymentInstallment.reducePenalty()`). `null` only when neither applies: a migrated
     * loan with no override (falls back to `due.penalty`, the real historical figure) or no
     * context supplied at all.
     */
    currentPenaltyOwed,
    /** `true` only when `currentPenaltyOwed` reflects the live ADR-050 formula, not a frozen override — lets the frontend show "(as of today)" only when actually accurate. */
    isLivePenalty: isLive && !override,
    /** 2026-07-15 (Reduce Penalty feature) — null unless an Accounting/MIS reduction has been applied to this installment. */
    penaltyOverride: override
      ? {
          amount: override.amount.toString(),
          reason: override.reason,
          byUserId: override.byUserId,
          // Hydrated by the repository's read path (findById/findByLoanAccountId's join) — may be
          // undefined if that join somehow didn't resolve (e.g. the user was since deleted); falls
          // back to null rather than throwing, since this is a display convenience, not a business
          // invariant.
          byName: override.byName ?? null,
          at: override.at.toISOString(),
        }
      : null,
    /**
     * 2026-07-16 (Adjust Fees feature): the fees override amount if one is set, else `due.fees` —
     * always non-null, unlike `currentPenaltyOwed`, since fees have no "live computation" concept
     * to fall back to null for (see `RepaymentInstallment.effectiveFeesDue`'s own doc comment).
     */
    currentFeesDue: installment.effectiveFeesDue.toString(),
    /** 2026-07-16 (Adjust Fees feature) — null unless an Accounting/MIS adjustment has been applied to this installment. Same shape/hydration story as `penaltyOverride`. */
    feesOverride: installment.feesOverride
      ? {
          amount: installment.feesOverride.amount.toString(),
          reason: installment.feesOverride.reason,
          byUserId: installment.feesOverride.byUserId,
          byName: installment.feesOverride.byName ?? null,
          at: installment.feesOverride.at.toISOString(),
        }
      : null,
  };
}
