import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { PenaltyCalculator } from '@shared/domain/calculation/PenaltyCalculator';
import { SEC_MC3_PENALTY_RATE_PERCENT_PER_MONTH } from '@shared/domain/compliance/SecMc3Coverage';
import type { RepaymentInstallment } from './RepaymentInstallment';

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

/** BSP Circular 1133 / SEC MC 3 (`ADR-053`) — the ceiling used INSTEAD of the ADR-050 rates above, for a loan confirmed SEC-MC3-covered. */
const SEC_MC3_PENALTY_RATE = Percentage.of(String(SEC_MC3_PENALTY_RATE_PERCENT_PER_MONTH));

function resolvePenaltyRatePercent(principalAmount: Money): Percentage {
  return principalAmount.greaterThan(SMALL_LOAN_THRESHOLD) ? STANDARD_RATE : SMALL_LOAN_RATE;
}

/**
 * Context needed to compute a live "penalty owed as of today" figure — omitted entirely for a
 * migrated (legacy) loan, per `ADR-050` §5's prospective-only scope: migrated loans' stored
 * `due.penalty` is a historical snapshot from CP12 migration, never live-recomputed.
 */
export interface PenaltyComputationContext {
  /** `true` when the loan has no `legacyId` — i.e. originated through this system, not migrated. */
  isProspectiveLoan: boolean;
  principalAmount: Money;
  /** `ADR-053` — when true, use the SEC MC 3 ceiling (5%/month, simple/non-compounding) instead of the ADR-050 rates. Resolved by the caller via `isSecMc3Covered()` against the loan's product/principal/tenor/origination date. */
  isSecMc3Covered: boolean;
}

/**
 * 2026-07-15 (Reduce Penalty feature): extracted from `RepaymentInstallmentPresenter` so both it
 * (display) and `ReducePenaltyUseCase` (the reduction's validation ceiling — "new amount must not
 * exceed what's currently owed") always agree on what "currently owed" means, rather than each
 * re-implementing the ADR-050 formula and risking drift.
 *
 * Resolves what an installment's penalty is right now, BEFORE any manual override
 * (`RepaymentInstallment.penaltyOverride`) is applied — live-computed for a prospective loan's
 * still-open installment, or the migrated snapshot (`due.penalty`) otherwise.
 */
export function resolveComputedPenalty(
  installment: RepaymentInstallment,
  penaltyContext: PenaltyComputationContext | undefined,
  asOfDate: Date = new Date(),
): Money {
  if (penaltyContext?.isProspectiveLoan && installment.status !== 'PAID') {
    const overdueAmount = installment.due.principal
      .add(installment.due.interest)
      .subtract(installment.paid.principal.add(installment.paid.interest));

    if (penaltyContext.isSecMc3Covered) {
      // ADR-053: SEC MC 3's own 5%/month ceiling, simple/non-compounding — replaces the ADR-050
      // rates below entirely for a covered loan, not layered on top of them.
      return PenaltyCalculator.calculateSimple({
        overdueAmount,
        dueDate: installment.dueDate,
        asOfDate,
        ratePercent: SEC_MC3_PENALTY_RATE,
        gracePeriodDays: GRACE_PERIOD_DAYS,
      });
    }

    return PenaltyCalculator.calculate({
      overdueAmount,
      dueDate: installment.dueDate,
      asOfDate,
      ratePercent: resolvePenaltyRatePercent(penaltyContext.principalAmount),
      gracePeriodDays: GRACE_PERIOD_DAYS,
    });
  }
  return installment.due.penalty;
}

/**
 * 2026-07-16 (Reduce Penalty payment-allocation sync fix): for a *chargeable* amount — what a real
 * payment is actually allocated against — only an explicit `penaltyOverride` should override
 * `due.penalty`. This deliberately does NOT fall back to `resolveComputedPenalty`'s live ADR-050
 * formula the way the display layer (`RepaymentInstallmentPresenter`) does: that formula is a
 * today-relative *projection* for what staff sees on screen, not a value ever posted to the ledger
 * or otherwise treated as collectible — `ProcessPaymentUseCase`'s allocation engine has always
 * allocated against the frozen `due.penalty` regardless of how much ADR-050 projects is owed today,
 * and this function preserves that (confirmed via `GoldenMasterReplay.test.ts`, whose fixture loans
 * broke when an earlier version of this function called `resolveComputedPenalty` unconditionally).
 * `penaltyOverride`, once set, IS a committed, non-projected figure — so it's the one exception.
 *
 * 2026-07-16 (LoanAccount.penaltyBalance sync): reused by `ReducePenaltyUseCase` for the exact same
 * reason — `LoanAccount.balances.penaltyBalance`/`penaltyDue` were seeded from `due.penalty`, never
 * from the live ADR-050 projection, so this (not `resolveComputedPenalty`) is the "previous effective
 * amount" a reduction's balance-sync delta must be computed against, on both a first reduction
 * (previous = frozen `due.penalty`) and a repeated one (previous = the existing override).
 */
export function resolveEffectivePenaltyDue(installment: RepaymentInstallment): Money {
  return installment.penaltyOverride?.amount ?? installment.due.penalty;
}
