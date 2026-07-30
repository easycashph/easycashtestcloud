import type { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';

/**
 * `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §1 — Declining-Balance
 * Interest Per Period. `STATUS: CONFIRMED`, verified exactly against real
 * transaction data on two products (see the spec's Examples table).
 *
 * Formula: `Interest_n = OutstandingPrincipalBalance_(n-1) ×
 * MonthlyContractualRate`. Applies identically to both
 * `InterestCalculationMethod.DECLINING_BALANCE` and
 * `DECLINING_BALANCE_DISCOUNTED` — see `ADR-010-addon-vs-contractual-
 * interest.md` §5: no runtime calculation difference was found between the
 * two enum values across the entire legacy population checked.
 *
 * Deliberately does not duplicate any rounding logic: `Money.multiply()`
 * already performs exactly the single-multiplication, half-up rounding to
 * `Decimal(14,2)` this formula requires (per the spec's own "Rounding"
 * section), so this calculator is a thin, named wrapper for traceability
 * back to the spec — not a reimplementation.
 */
export class DecliningBalanceInterestCalculator {
  static calculate(outstandingPrincipalBalance: Money, monthlyContractualRate: Percentage): Money {
    return outstandingPrincipalBalance.multiply(monthlyContractualRate);
  }
}
