import { Decimal } from 'decimal.js';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import { manilaDaysBetween, manilaWholeMonthsBetween } from '@shared/domain/manilaTime';

/**
 * 2026-08-12 (user-confirmed): a flat 30, replacing the installment's own due-month length
 * (28/29/30/31, the legacy Excel tool's "End of the month" column). That made the SAME 30 days of
 * lateness cost a different amount depending on which month the due date happened to fall in —
 * ₱3,145.08 in February against ₱2,840.72 in a 31-day month on an identical ₱29,354.10 balance, a
 * ₱304.36 spread with no business meaning behind it. A flat 30 also brings this in line with the
 * Statement of Account, which has always divided by 30.
 */
const DAYS_PER_MONTH = 30;

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
 * `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §12 / `ADR-050` — `STATUS: CONFIRMED` via direct
 * business/MIS testimony (2026-07-11), for loans originated going forward only (see `ADR-050` §5 —
 * this calculator is never applied to already-migrated loans' stored penalty figures).
 *
 * **2026-07-28 (user-confirmed, `ADR-050` §8/§9):** daily-prorated simple interest:
 * `overdueAmount × rate ÷ 30 × daysLate`, where `daysLate` is the whole Manila calendar-day count
 * from the original due date to `asOfDate` (no grace period — see §9: grace-period forgiveness for
 * an early payer is now a manual staff adjustment via Reduce Penalty, not an automatic zero built
 * into the formula). `gracePeriodDays` is accepted for interface parity with `calculateSimple()`
 * but intentionally unused here. Rounded once via `Money`'s half-up-to-centavo arithmetic.
 *
 * **2026-08-12 (user-confirmed):** the divisor is a flat 30 — see `DAYS_PER_MONTH` above for why it
 * is no longer the installment's own due-month length.
 */
export class PenaltyCalculator {
  static calculate(input: PenaltyCalculatorInput): Money {
    const daysLate = manilaDaysBetween(input.dueDate, input.asOfDate);
    if (daysLate <= 0) {
      return Money.ZERO;
    }

    const amount = input.overdueAmount
      .toDecimal()
      .times(input.ratePercent.asFraction())
      .dividedBy(DAYS_PER_MONTH)
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

    const monthsLate = manilaWholeMonthsBetween(input.dueDate, input.asOfDate);
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
