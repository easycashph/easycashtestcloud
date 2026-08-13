import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { PenaltyCalculator } from '@shared/domain/calculation/PenaltyCalculator';

// ADR-050 / CALCULATION_ENGINE_SPEC.md §12 — STATUS: CONFIRMED via direct business/MIS testimony
// (2026-07-11), formula reversed to daily-prorated on 2026-07-28 (ADR-050 §8).
//
// 2026-08-12 (user-confirmed): the divisor is now a FLAT 30, replacing the installment's own
// due-month day count. Under the old rule the same 30 days of lateness cost a different amount
// depending on which month the due date happened to land in — see `DAYS_PER_MONTH`'s doc comment in
// PenaltyCalculator for the worked figures. It also brings this in line with the Statement of
// Account, which has always divided by 30.
describe('PenaltyCalculator (ADR-050 / CALC-SPEC §12, daily-prorated, flat 30-day divisor as of 2026-08-12)', () => {
  it('prorates linearly at 10% (92 days late, due 2026-07-01, as-of 2026-10-01)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-10-01T00:00:00Z'),
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    // 10000 x 10% / 30 x 92 days = 3066.666... -> 3066.67
    expect(result.toString()).toBe('3066.67');
  });

  it('prorates linearly at 5% for the small-unsecured-loan tier (60 days late = exactly two months)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-08-30T00:00:00Z'),
      ratePercent: Percentage.of('5'),
      gracePeriodDays: 3,
    });
    // 10000 x 5% / 30 x 60 days = 1000.00
    expect(result.toString()).toBe('1000.00');
  });

  it('charges a penalty starting the very first day after the due date - no grace period', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-02T00:00:00Z'), // 1 day late - would have been zero under the old 3-day grace period
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    // 10000 x 10% / 30 x 1 day = 33.33
    expect(result.toString()).toBe('33.33');
  });

  it('charges the same for the same lateness regardless of which month the due date falls in', () => {
    const forDueDate = (dueDate: string, asOfDate: string) =>
      PenaltyCalculator.calculate({
        overdueAmount: Money.of('10000.00'),
        dueDate: new Date(dueDate),
        asOfDate: new Date(asOfDate),
        ratePercent: Percentage.of('10'),
        gracePeriodDays: 3,
      }).toString();

    // 30 days late in each case. Under the old due-month divisor these were 1071.43 (Feb, /28),
    // 1000.00 (Apr, /30) and 967.74 (Jul, /31) - a ₱103.69 spread with no business meaning.
    expect(forDueDate('2026-02-01T00:00:00Z', '2026-03-03T00:00:00Z')).toBe('1000.00');
    expect(forDueDate('2026-04-01T00:00:00Z', '2026-05-01T00:00:00Z')).toBe('1000.00');
    expect(forDueDate('2026-07-01T00:00:00Z', '2026-07-31T00:00:00Z')).toBe('1000.00');
  });

  it('accrues proportionally more the longer an installment stays overdue (no whole-month gating)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-25T00:00:00Z'), // 24 days late, well under what used to require a full month
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    // 10000 x 10% / 30 x 24 days = 800.00
    expect(result.toString()).toBe('800.00');
  });

  it('returns zero when asOfDate equals the due date (not yet late at all)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-01T00:00:00Z'),
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(result.isZero()).toBe(true);
  });

  it('returns zero for a zero overdue amount regardless of how late it is', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.ZERO,
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2027-01-01T00:00:00Z'),
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(result.isZero()).toBe(true);
  });

  it('never returns a negative penalty when asOfDate is before the due date (should not happen in practice, but must not go negative)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-06-01T00:00:00Z'),
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(result.isZero()).toBe(true);
  });
});

// ADR-053 — BSP Circular 1133 / SEC MC 3's "5 percent per month on outstanding scheduled amount
// due", read as SIMPLE (non-compounding), for loans confirmed SEC-MC3-covered.
describe('PenaltyCalculator.calculateSimple (ADR-053)', () => {
  it('is LINEAR (not compounding) across multiple whole months, unlike calculate()', () => {
    const result = PenaltyCalculator.calculateSimple({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-09-01T00:00:00Z'), // 2 whole months late
      ratePercent: Percentage.of('5'),
      gracePeriodDays: 3,
    });
    // Simple: 10000 x 5% x 2 = 1000.00 (vs. calculate()'s compounding 1025.00 for the same inputs).
    expect(result.toString()).toBe('1000.00');
  });

  it('matches calculate() for exactly one whole month (compounding and simple are identical at month 1)', () => {
    const simple = PenaltyCalculator.calculateSimple({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-08-01T00:00:00Z'),
      ratePercent: Percentage.of('5'),
      gracePeriodDays: 3,
    });
    expect(simple.toString()).toBe('500.00');
  });

  it('charges zero penalty within the grace period', () => {
    const result = PenaltyCalculator.calculateSimple({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-04T00:00:00Z'),
      ratePercent: Percentage.of('5'),
      gracePeriodDays: 3,
    });
    expect(result.isZero()).toBe(true);
  });

  it('charges zero penalty before a whole month has passed (no proration), same as calculate()', () => {
    const result = PenaltyCalculator.calculateSimple({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-25T00:00:00Z'),
      ratePercent: Percentage.of('5'),
      gracePeriodDays: 3,
    });
    expect(result.isZero()).toBe(true);
  });
});
