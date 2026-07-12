import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { PenaltyCalculator } from '@shared/domain/calculation/PenaltyCalculator';

// ADR-050 / CALCULATION_ENGINE_SPEC.md §12 — STATUS: CONFIRMED via direct business/MIS testimony
// (2026-07-11). Test vectors are cited from ADR-050 §1's worked example, not synthetic guesses.
describe('PenaltyCalculator (ADR-050 / CALC-SPEC §12)', () => {
  it('matches ADR-050 §1\'s worked example exactly: ₱10,000 @ 10%, 3 whole months late (due 2026-07-01, paid 2026-10-01)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-10-01T00:00:00Z'),
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(result.toString()).toBe('3310.00');
  });

  it('compounds at 5% for the small-unsecured-loan tier (two whole months late)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-09-01T00:00:00Z'),
      ratePercent: Percentage.of('5'),
      gracePeriodDays: 3,
    });
    // Month 1: 10000 * 5% = 500 -> 10500. Month 2: 10500 * 5% = 525 -> 11025. Penalty = 1025.00.
    expect(result.toString()).toBe('1025.00');
  });

  it('charges zero penalty when paid within the grace period', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-04T00:00:00Z'), // exactly at grace end (due + 3 days)
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(result.isZero()).toBe(true);
  });

  it('charges zero penalty the instant the grace period ends but before a whole month has passed (no proration)', () => {
    const result = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-25T00:00:00Z'), // past grace (July 4), but well under 1 whole month from the due date
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(result.isZero()).toBe(true);
  });

  it('charges exactly one month\'s penalty once a full month has elapsed past the due date, not before', () => {
    const justUnderOneMonth = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-07-31T00:00:00Z'), // one day short of a full month from July 1
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(justUnderOneMonth.isZero()).toBe(true);

    const exactlyOneMonth = PenaltyCalculator.calculate({
      overdueAmount: Money.of('10000.00'),
      dueDate: new Date('2026-07-01T00:00:00Z'),
      asOfDate: new Date('2026-08-01T00:00:00Z'),
      ratePercent: Percentage.of('10'),
      gracePeriodDays: 3,
    });
    expect(exactlyOneMonth.toString()).toBe('1000.00');
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
