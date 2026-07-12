import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { PenaltyCalculator } from '@shared/domain/calculation/PenaltyCalculator';
import type { RepaymentInstallment } from '../../../domain/RepaymentInstallment';
import type { InstallmentAmounts } from '../../../domain/valueObjects/InstallmentAmounts';

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

/**
 * `ADR-050` / `CALCULATION_ENGINE_SPEC.md` §12 — 2026-07-11, user request: 5% per month for
 * unsecured loans with principal ≤₱10,000, 10% otherwise (all Easycash loans are unsecured).
 * Resolved per loan from its own `principalAmount`, uniformly across every product — deliberately
 * NOT a per-`LoanProductVersion` `PenaltyRule` value (see `ADR-050` §4 for why a single product
 * version's amount range can straddle the ₱10,000 line).
 */
const SMALL_LOAN_THRESHOLD = Money.of('10000.00');
const SMALL_LOAN_RATE = Percentage.of('5');
const STANDARD_RATE = Percentage.of('10');
const GRACE_PERIOD_DAYS = 3;

function resolvePenaltyRatePercent(principalAmount: Money): Percentage {
  return principalAmount.greaterThan(SMALL_LOAN_THRESHOLD) ? STANDARD_RATE : SMALL_LOAN_RATE;
}

/**
 * Context needed to compute a live "penalty owed as of today" figure — omitted entirely (`null`)
 * for a migrated (legacy) loan, per `ADR-050` §5's prospective-only scope: migrated loans' stored
 * `due.penalty` is a historical snapshot from CP12 migration, never live-recomputed.
 */
export interface PenaltyComputationContext {
  /** `true` when the loan has no `legacyId` — i.e. originated through this system, not migrated. */
  isProspectiveLoan: boolean;
  principalAmount: Money;
}

export function presentRepaymentInstallment(installment: RepaymentInstallment, penaltyContext?: PenaltyComputationContext) {
  const currentPenaltyOwed =
    penaltyContext?.isProspectiveLoan && installment.status !== 'PAID'
      ? PenaltyCalculator.calculate({
          overdueAmount: installment.due.principal.add(installment.due.interest).subtract(
            installment.paid.principal.add(installment.paid.interest),
          ),
          dueDate: installment.dueDate,
          asOfDate: new Date(),
          ratePercent: resolvePenaltyRatePercent(penaltyContext.principalAmount),
          gracePeriodDays: GRACE_PERIOD_DAYS,
        }).toString()
      : null;

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
     * Live-computed "as of today" penalty (`ADR-050`) — `null` for a migrated loan (see
     * `PenaltyComputationContext`'s own doc comment) or when no context was supplied at all.
     * Deliberately separate from `due.penalty`, which stays immutable per REPAY-3 and, for a
     * migrated loan, is the real historical figure from the legacy system.
     */
    currentPenaltyOwed,
  };
}
