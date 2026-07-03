import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { AmortizationScheduleGenerator } from '@shared/domain/calculation/AmortizationScheduleGenerator';
import { InvalidAmortizationInputError } from '@shared/domain/calculation/errors/CalculationDomainErrors';

describe('AmortizationScheduleGenerator (CALC-SPEC §2)', () => {
  // The one full worked example documented in CALC-SPEC §2's Examples
  // table, sourced from `Sample Computation Sheet updated.xlsx`.
  describe('worked example: 80,953.71 principal / 3.7% monthly / 8 installments', () => {
    const principal = Money.of('80953.71');
    const rate = Percentage.of('3.7');

    it('computes the documented monthly payment exactly (11,875.38)', () => {
      const { monthlyPayment } = AmortizationScheduleGenerator.generate(principal, rate, 8);
      expect(monthlyPayment.toString()).toBe('11875.38');
    });

    it('produces a schedule with one entry per installment, each carrying the same payment', () => {
      const { schedule, monthlyPayment } = AmortizationScheduleGenerator.generate(principal, rate, 8);

      expect(schedule).toHaveLength(8);
      schedule.forEach((entry, index) => {
        expect(entry.installmentNumber).toBe(index + 1);
        expect(entry.payment.toString()).toBe(monthlyPayment.toString());
      });
    });

    it('chains each period\'s ending principal into the next period\'s beginning principal', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(principal, rate, 8);

      expect(schedule[0]?.beginningPrincipal.toString()).toBe('80953.71');
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i]?.beginningPrincipal.toString()).toBe(schedule[i - 1]?.endingPrincipal.toString());
      }
    });

    it('matches the exact per-period interest/principal split (half-up rounded at each step)', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(principal, rate, 8);

      // Independently computed once via raw Prisma.Decimal arithmetic
      // (same formula, same ROUND_HALF_UP convention) before writing this
      // test, to have a known-correct oracle for exactly what this
      // formula — not any alternative rounding treatment — produces.
      const expected = [
        { interest: '2995.29', principal: '8880.09', ending: '72073.62' },
        { interest: '2666.72', principal: '9208.66', ending: '62864.96' },
        { interest: '2326.00', principal: '9549.38', ending: '53315.58' },
        { interest: '1972.68', principal: '9902.70', ending: '43412.88' },
        { interest: '1606.28', principal: '10269.10', ending: '33143.78' },
        { interest: '1226.32', principal: '10649.06', ending: '22494.72' },
        { interest: '832.30', principal: '11043.08', ending: '11451.64' },
        { interest: '423.71', principal: '11451.67', ending: '-0.03' },
      ];

      schedule.forEach((entry, index) => {
        expect(entry.interestPortion.toString()).toBe(expected[index]?.interest);
        expect(entry.principalPortion.toString()).toBe(expected[index]?.principal);
        expect(entry.endingPrincipal.toString()).toBe(expected[index]?.ending);
      });
    });
  });

  describe('single-installment edge case', () => {
    it('reduces algebraically to Principal * (1 + rate) — not a separately invented formula', () => {
      const principal = Money.of('1000.00');
      const rate = Percentage.of('5.0');

      const { monthlyPayment, schedule } = AmortizationScheduleGenerator.generate(principal, rate, 1);

      // 1000.00 * 1.05 = 1050.00
      expect(monthlyPayment.toString()).toBe('1050.00');
      expect(schedule).toHaveLength(1);
      expect(schedule[0]?.interestPortion.toString()).toBe('50.00');
      expect(schedule[0]?.principalPortion.toString()).toBe('1000.00');
      expect(schedule[0]?.endingPrincipal.toString()).toBe('0.00');
    });
  });

  describe('validation', () => {
    const principal = Money.of('1000.00');
    const rate = Percentage.of('5.0');

    it.each([0, -1, 1.5, -3.2])('rejects a non-positive or non-integer installmentCount (%s)', (installmentCount) => {
      expect(() => AmortizationScheduleGenerator.generate(principal, rate, installmentCount)).toThrow(
        InvalidAmortizationInputError,
      );
    });

    it('rejects a zero rate (would divide by zero; the degenerate-case formula is not evidenced)', () => {
      expect(() => AmortizationScheduleGenerator.generate(principal, Percentage.of('0'), 12)).toThrow(
        InvalidAmortizationInputError,
      );
    });

    it('rejects a negative rate', () => {
      expect(() => AmortizationScheduleGenerator.generate(principal, Percentage.of('-1.5'), 12)).toThrow(
        InvalidAmortizationInputError,
      );
    });
  });

  describe('rounding', () => {
    it('the monthly payment is always exactly 2 decimal places', () => {
      const { monthlyPayment } = AmortizationScheduleGenerator.generate(Money.of('12345.67'), Percentage.of('3.14'), 5);
      expect(monthlyPayment.toString()).toMatch(/^\d+\.\d{2}$/);
    });

    it('every schedule entry\'s Money fields are exactly 2 decimal places', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(Money.of('12345.67'), Percentage.of('3.14'), 5);
      for (const entry of schedule) {
        expect(entry.interestPortion.toString()).toMatch(/^-?\d+\.\d{2}$/);
        expect(entry.principalPortion.toString()).toMatch(/^-?\d+\.\d{2}$/);
        expect(entry.endingPrincipal.toString()).toMatch(/^-?\d+\.\d{2}$/);
      }
    });
  });

  /**
   * Invariant that holds UNCONDITIONALLY, for any valid input — not
   * because of anything about a particular loan's numbers, but because of
   * how `principalPortion` is *defined* in this implementation:
   * `principalPortion_n = payment - interestPortion_n` (an exact `Money`
   * subtraction, never independently rounded). Summing both sides over
   * every period telescopes to `Σpayment = payment × installmentCount`
   * regardless of what `interestPortion_n` rounds to at each step. This is
   * a genuine, always-true invariant of the code as written — distinct
   * from the principal-reconciliation question below, which is NOT
   * unconditionally true.
   */
  describe('invariant: interest + principal always telescopes exactly to payment × installmentCount', () => {
    it.each([
      ['80953.71', '3.7', 8],
      ['1000.00', '5.0', 1],
      ['12345.67', '3.14', 5],
      ['500000.00', '2.75', 12],
    ])('principal=%s rate=%s%% n=%i', (principal, rate, installmentCount) => {
      const { monthlyPayment, schedule } = AmortizationScheduleGenerator.generate(
        Money.of(principal),
        Percentage.of(rate),
        installmentCount,
      );

      const sumOfParts = schedule.reduce(
        (total, entry) => total.add(entry.interestPortion).add(entry.principalPortion),
        Money.ZERO,
      );
      const expectedTotal = schedule.reduce((total) => total.add(monthlyPayment), Money.ZERO);

      expect(sumOfParts.toString()).toBe(expectedTotal.toString());
    });
  });

  /**
   * Characterization test — NOT an invariant assertion. Documents the
   * schedule's CURRENT, observed rounding behavior for the CALC-SPEC §2
   * worked example, so a future change to this file changes these numbers
   * *intentionally*, not by accident.
   *
   * `Σ principalPortion` does NOT equal the original principal exactly,
   * and the final period's `endingPrincipal` does NOT land on exactly
   * 0.00. This is the correct, expected consequence of rounding
   * `interestPortion` to the centavo at every period (CALC-SPEC §1's
   * Rounding rule) — not a bug in this implementation.
   *
   * Reconciling this residual (e.g. absorbing it into the final
   * installment) is `LoanProductVersion.roundingMethod =
   * ROUND_REMAINDER_INTO_LAST_REPAYMENT`, which
   * `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §7 explicitly marks
   * `STATUS: UNRESOLVED`. This checkpoint implements only the CONFIRMED
   * §1/§2 formulas — it deliberately does NOT implement a remainder-
   * allocation rule, so this residual is expected to exist until §7 is
   * resolved and a future checkpoint implements it.
   */
  describe('known limitation: exact principal reconciliation depends on CALC-SPEC §7 (ROUND_REMAINDER_INTO_LAST_REPAYMENT, UNRESOLVED)', () => {
    it('the worked example\'s summed principal portions currently differ from the original principal by a small, documented residual', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(Money.of('80953.71'), Percentage.of('3.7'), 8);

      const sumOfPrincipalPortions = schedule.reduce((total, entry) => total.add(entry.principalPortion), Money.ZERO);

      // Observed today: 80,953.74 vs. an original principal of 80,953.71
      // — a 0.03 residual, not zero. If this assertion ever fails, it
      // means either the formula, the rounding convention, or (once
      // built) a remainder-allocation rule changed — investigate before
      // updating this expectation, do not update it reflexively.
      expect(sumOfPrincipalPortions.toString()).toBe('80953.74');
      expect(sumOfPrincipalPortions.toString()).not.toBe('80953.71');
    });

    it('the worked example\'s final ending principal currently does not land exactly on 0.00', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(Money.of('80953.71'), Percentage.of('3.7'), 8);
      const finalEntry = schedule.at(-1);

      // Observed today: a -0.03 residual on the last installment. Per
      // CALC-SPEC §7 (UNRESOLVED), no remainder-allocation rule is
      // implemented to absorb this into the final payment — this test
      // exists to make that gap visible and intentional, not to assert
      // it is correct or desirable in the long run.
      expect(finalEntry?.endingPrincipal.toString()).toBe('-0.03');
      expect(finalEntry?.endingPrincipal.isZero()).toBe(false);
    });
  });
});
