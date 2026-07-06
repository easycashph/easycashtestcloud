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

    it('produces a schedule with one entry per installment; every installment except the last carries the same payment', () => {
      const { schedule, monthlyPayment } = AmortizationScheduleGenerator.generate(principal, rate, 8);

      expect(schedule).toHaveLength(8);
      schedule.forEach((entry, index) => {
        expect(entry.installmentNumber).toBe(index + 1);
        if (index < schedule.length - 1) {
          expect(entry.payment.toString()).toBe(monthlyPayment.toString());
        }
      });
      // The final installment's payment absorbs the rounding residual
      // (ROUND_REMAINDER_INTO_LAST_REPAYMENT, CALC-SPEC §7) — differs
      // slightly from the regular monthlyPayment. See the "principal
      // reconciliation" describe block below for the exact numbers.
      expect(schedule.at(-1)?.payment.toString()).not.toBe(monthlyPayment.toString());
    });

    it('chains each period\'s ending principal into the next period\'s beginning principal', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(principal, rate, 8);

      expect(schedule[0]?.beginningPrincipal.toString()).toBe('80953.71');
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i]?.beginningPrincipal.toString()).toBe(schedule[i - 1]?.endingPrincipal.toString());
      }
    });

    it('matches the exact per-period interest/principal split (half-up rounded at each step; final installment reconciled per CALC-SPEC §7)', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(principal, rate, 8);

      // Independently computed once via raw Prisma.Decimal arithmetic
      // (same formula, same ROUND_HALF_UP convention) before writing this
      // test, to have a known-correct oracle for exactly what this
      // formula — not any alternative rounding treatment — produces.
      // The final installment's principal/ending differ from the naive
      // per-period formula (11451.67 / -0.03) because
      // ROUND_REMAINDER_INTO_LAST_REPAYMENT (business-decided 2026-07-06)
      // makes principal absorb the residual there, landing on exactly 0.00.
      const expected = [
        { interest: '2995.29', principal: '8880.09', ending: '72073.62' },
        { interest: '2666.72', principal: '9208.66', ending: '62864.96' },
        { interest: '2326.00', principal: '9549.38', ending: '53315.58' },
        { interest: '1972.68', principal: '9902.70', ending: '43412.88' },
        { interest: '1606.28', principal: '10269.10', ending: '33143.78' },
        { interest: '1226.32', principal: '10649.06', ending: '22494.72' },
        { interest: '832.30', principal: '11043.08', ending: '11451.64' },
        { interest: '423.71', principal: '11451.64', ending: '0.00' },
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
   * `principalPortion_n = payment_n - interestPortion_n` (an exact `Money`
   * subtraction, never independently rounded, true for every period
   * including the reconciled final one — see the constructor code).
   * Summing both sides over every period telescopes to `Σpayment_n`
   * regardless of what `interestPortion_n` rounds to at each step, and
   * regardless of the final installment's `payment_n` differing from the
   * regular `monthlyPayment` (CALC-SPEC §7 reconciliation). Sums each
   * entry's own `payment` field rather than assuming a uniform
   * `monthlyPayment × installmentCount`, precisely because that assumption
   * is no longer true for the final installment.
   */
  describe('invariant: interest + principal always telescopes exactly to the sum of each installment\'s own payment', () => {
    it.each([
      ['80953.71', '3.7', 8],
      ['1000.00', '5.0', 1],
      ['12345.67', '3.14', 5],
      ['500000.00', '2.75', 12],
    ])('principal=%s rate=%s%% n=%i', (principal, rate, installmentCount) => {
      const { schedule } = AmortizationScheduleGenerator.generate(Money.of(principal), Percentage.of(rate), installmentCount);

      const sumOfParts = schedule.reduce(
        (total, entry) => total.add(entry.interestPortion).add(entry.principalPortion),
        Money.ZERO,
      );
      const sumOfPayments = schedule.reduce((total, entry) => total.add(entry.payment), Money.ZERO);

      expect(sumOfParts.toString()).toBe(sumOfPayments.toString());
    });
  });

  /**
   * `ROUND_REMAINDER_INTO_LAST_REPAYMENT` (CALC-SPEC §7), business-decided
   * 2026-07-06: principal — never interest — absorbs the cumulative
   * per-period rounding residual on the final installment, so the schedule
   * always reconciles to exactly zero. Before this decision, the worked
   * example ended at a -0.03 residual (see git history / this file's prior
   * revision for that characterization).
   */
  describe('principal reconciliation (CALC-SPEC §7, ROUND_REMAINDER_INTO_LAST_REPAYMENT, RESOLVED 2026-07-06)', () => {
    it('the worked example\'s summed principal portions equal the original principal exactly', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(Money.of('80953.71'), Percentage.of('3.7'), 8);

      const sumOfPrincipalPortions = schedule.reduce((total, entry) => total.add(entry.principalPortion), Money.ZERO);

      expect(sumOfPrincipalPortions.toString()).toBe('80953.71');
    });

    it('the worked example\'s final ending principal lands exactly on 0.00', () => {
      const { schedule } = AmortizationScheduleGenerator.generate(Money.of('80953.71'), Percentage.of('3.7'), 8);
      const finalEntry = schedule.at(-1);

      expect(finalEntry?.endingPrincipal.toString()).toBe('0.00');
      expect(finalEntry?.endingPrincipal.isZero()).toBe(true);
    });

    it('the final installment\'s payment absorbs the residual — differs from the regular monthlyPayment by exactly that amount', () => {
      const { schedule, monthlyPayment } = AmortizationScheduleGenerator.generate(Money.of('80953.71'), Percentage.of('3.7'), 8);
      const finalEntry = schedule.at(-1);

      // 11875.38 (regular) - 11875.35 (final, reconciled) = 0.03, the
      // exact residual absorbed into principal.
      expect(monthlyPayment.toString()).toBe('11875.38');
      expect(finalEntry?.payment.toString()).toBe('11875.35');
    });

    it.each([
      ['80953.71', '3.7', 8],
      ['1000.00', '5.0', 1],
      ['12345.67', '3.14', 5],
      ['500000.00', '2.75', 12],
    ])('reconciles exactly to zero for principal=%s rate=%s%% n=%i, regardless of installment count or rate', (principal, rate, installmentCount) => {
      const { schedule } = AmortizationScheduleGenerator.generate(Money.of(principal), Percentage.of(rate), installmentCount);

      expect(schedule.at(-1)?.endingPrincipal.toString()).toBe('0.00');

      const sumOfPrincipalPortions = schedule.reduce((total, entry) => total.add(entry.principalPortion), Money.ZERO);
      expect(sumOfPrincipalPortions.toString()).toBe(Money.of(principal).toString());
    });
  });
});
