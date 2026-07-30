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

/** Whole calendar-day difference from `from` to `to` (never negative). */
function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24)));
}

/**
 * Number of calendar days in the month `date` falls in (28/29/30/31) — `ADR-050` §9: the
 * divisor for daily proration is the installment's OWN due-month length, not a flat 30, matching
 * the user's own Excel reference tool exactly (its "End of the month" column).
 */
function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Whole calendar months elapsed from `start` to `end` (`end` assumed >= `start`) — the same
 * "hasn't had its birthday yet this year" arithmetic used for age-in-years, applied to months.
 * Only `calculateSimple()` (ADR-053, SEC MC3) uses this now — `calculate()` switched to daily
 * proration on 2026-07-28 (see below) and no longer needs whole-month counting.
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
 * **2026-07-28 (user-confirmed, `ADR-050` §8/§9):** daily-prorated simple interest, matching the
 * user's own Excel reference tool exactly:
 * `overdueAmount × rate ÷ daysInDueMonth × daysLate`, where `daysLate` is the whole calendar-day
 * count from the original due date to `asOfDate` (no grace period — see §9: grace-period
 * forgiveness for an early payer is now a manual staff adjustment via Reduce Penalty, not an
 * automatic zero built into the formula), and `daysInDueMonth` is the actual number of days in the
 * calendar month the installment's own due date falls in (28/29/30/31), not a flat 30.
 * `gracePeriodDays` is accepted for interface parity with `calculateSimple()` but intentionally
 * unused here. Rounded once via `Money`'s half-up-to-centavo arithmetic.
 */
export class PenaltyCalculator {
  static calculate(input: PenaltyCalculatorInput): Money {
    const daysLate = daysBetween(input.dueDate, input.asOfDate);
    if (daysLate <= 0) {
      return Money.ZERO;
    }

    const amount = input.overdueAmount
      .toDecimal()
      .times(input.ratePercent.asFraction())
      .dividedBy(daysInMonth(input.dueDate))
      .times(daysLate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return Money.of(amount);
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
