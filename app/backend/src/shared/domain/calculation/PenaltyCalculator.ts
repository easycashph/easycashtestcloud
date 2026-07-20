import { Decimal } from 'decimal.js';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';

export interface PenaltyCalculatorInput {
  /** The unpaid Principal + Interest for the installment — not principal alone (`ADR-050` §1). */
  overdueAmount: Money;
  dueDate: Date;
  /** Defaults to "now" at the call site — the date penalty is being computed as of. */
  asOfDate: Date;
  /** From the loan's `PenaltyRule` snapshot — 5 or 10 (`ADR-050` §1/§2). */
  ratePercent: Percentage;
  /** From the loan's `PenaltyRule` snapshot — 3 (`ADR-050` §1). */
  gracePeriodDays: number;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Whole calendar months elapsed from `start` to `end` (`end` assumed >= `start`) — the same
 * "hasn't had its birthday yet this year" arithmetic used for age-in-years, applied to months.
 * `CALCULATION_ENGINE_SPEC.md` §12's Formula explains why this counts from the original due date,
 * not from the grace-period end date.
 */
function wholeCalendarMonthsBetween(start: Date, end: Date): number {
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §12 / `ADR-050` — `STATUS: CONFIRMED` via direct
 * business/MIS testimony (2026-07-11), for loans originated going forward only (see `ADR-050` §5 —
 * this calculator is never applied to already-migrated loans' stored penalty figures).
 *
 * Formula: zero penalty within the grace period; past it, `overdueAmount × ((1 + rate)^monthsLate
 * − 1)`, compounded monthly, whole months only (no proration), each monthly step rounded via
 * `Money`'s own half-up-to-centavo arithmetic — see `ADR-050` §1's worked example, which this is
 * verified against exactly (₱10,000 @ 10%, 3 whole months late → ₱3,310.00 total penalty).
 */
export class PenaltyCalculator {
  static calculate(input: PenaltyCalculatorInput): Money {
    const graceEndDate = addDays(input.dueDate, input.gracePeriodDays);
    if (input.asOfDate.getTime() <= graceEndDate.getTime()) {
      return Money.ZERO;
    }

    const monthsLate = wholeCalendarMonthsBetween(input.dueDate, input.asOfDate);
    if (monthsLate <= 0) {
      return Money.ZERO;
    }

    let balance = input.overdueAmount;
    for (let i = 0; i < monthsLate; i++) {
      balance = balance.add(balance.multiply(input.ratePercent));
    }

    return balance.subtract(input.overdueAmount);
  }

  /**
   * BSP Circular 1133 / SEC MC 3 (`ADR-053`, 2026-07-20): "5 percent per month on outstanding
   * scheduled amount due" — read as SIMPLE (non-compounding), unlike `calculate()` above (ADR-050,
   * used for loans NOT covered by SEC MC 3). Same grace-period/whole-months-late gating as
   * `calculate()`, but `overdueAmount x rate x monthsLate` (linear), not compounded monthly.
   * Applied only to loans confirmed SEC-MC3-covered by the caller (`CurrentPenaltyResolver`) — this
   * method itself does not check coverage.
   */
  static calculateSimple(input: PenaltyCalculatorInput): Money {
    const graceEndDate = addDays(input.dueDate, input.gracePeriodDays);
    if (input.asOfDate.getTime() <= graceEndDate.getTime()) {
      return Money.ZERO;
    }

    const monthsLate = wholeCalendarMonthsBetween(input.dueDate, input.asOfDate);
    if (monthsLate <= 0) {
      return Money.ZERO;
    }

    const amount = input.overdueAmount
      .toDecimal()
      .times(input.ratePercent.asFraction())
      .times(monthsLate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return Money.of(amount);
  }
}
