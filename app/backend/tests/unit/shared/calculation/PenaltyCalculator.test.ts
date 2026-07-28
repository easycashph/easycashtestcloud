import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { PenaltyCalculator } from '@shared/domain/calculation/PenaltyCalculator';

// ADR-050 / CALCULATION_ENGINE_SPEC.md §12 — STATUS: CONFIRMED via direct business/MIS testimony
// (2026-07-11), formula reversed to daily-prorated on 2026-07-28 (ADR-050 §8), then aligned to the
// user's own Excel reference tool on 2026-07-28 (ADR-050 §9): no grace period, divisor is the
// installment's own due-month day count (not a flat 30).
describe('PenaltyCalculator (ADR-050 / CALC-SPEC §12, daily-prorated + Excel-aligned as of 2026-07-28)', () => {
  it('prorates linearly at 10% using July\'s own 31-day divisor (92 days late, due 2026-07-01, as-of 2026-10-01)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-10-01T00:00:00Z'),
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    // 10000 x 10% / 31 x 92 days = 2967.741935... -> 2967.74
    expect(result.toString()).toBe('2967.74');
  });

  it('prorates linearly at 5% for the small-unsecured-loan tier (62 days late, July\'s 31-day divisor)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-09-01T00:00:00Z'),
      ratePercent: Percentage.of('5'),
      gracePeriodDays: 3,
    });
    // 10000 x 5% / 31 x 62 days = 1000.00 (62 = exactly 2 x 31)
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
    // 10000 x 10% / 31 x 1 day = 32.26
    expect(result.toString()).toBe('32.26');
  });

  it('uses the divisor of the installment\'s own due month, not a flat 30 (February 2026 has 28 days)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-02-01T00:00:00Z'),
      asOfDate: new Date('2026-03-01T00:00:00Z'), // exactly 28 days late - all of February
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    // 10000 x 10% / 28 x 28 days = 1000.00 exactly (one full due-month's worth)
    expect(result.toString()).toBe('1000.00');
  });

  it('accrues proportionally more the longer an installment stays overdue (no whole-month gating)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-25T00:00:00Z'), // 24 days late, well under what used to require a full month
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    // 10000 x 10% / 31 x 24 days = 774.19
    expect(result.toString()).toBe('774.19');
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
