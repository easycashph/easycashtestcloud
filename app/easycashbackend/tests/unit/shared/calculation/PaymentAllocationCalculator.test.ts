import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { PaymentAllocationCalculator } from '@shared/domain/calculation/PaymentAllocationCalculator';
import { InvalidPaymentAllocationInputError } from '@shared/domain/calculation/errors/CalculationDomainErrors';

describe('PaymentAllocationCalculator (CALC-SPEC §5, ADR-009)', () => {
  describe('real-loan worked examples (CALC-SPEC §5 Examples table)', () => {
    it('SL-REG_U1V1J, installment 1, first payment: interest paid in full before principal', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('1748.94'),
        Money.of('0.00'), // feesDue
        Money.of('0.00'), // penaltyDue
        Money.of('880.24'), // interestDue
        Money.of('2617.64'), // principalDue
      );

      expect(result.feesApplied.toString()).toBe('0.00');
      expect(result.penaltyApplied.toString()).toBe('0.00');
      expect(result.interestApplied.toString()).toBe('880.24');
      expect(result.principalApplied.toString()).toBe('868.70');
      expect(result.remainder.toString()).toBe('0.00');
    });

    it('SML-MAX_K5W8S, 2020-05-18: entire payment absorbed by penalty despite nonzero interest/principal due', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('6518.95'),
        Money.of('0.00'), // feesDue
        Money.of('10000.00'), // penaltyDue — real record confirms penaltyDue >= paymentAmount
        Money.of('500.00'), // interestDue (nonzero, per the record)
        Money.of('1000.00'), // principalDue (nonzero, per the record)
      );

      expect(result.feesApplied.toString()).toBe('0.00');
      expect(result.penaltyApplied.toString()).toBe('6518.95');
      expect(result.interestApplied.toString()).toBe('0.00');
      expect(result.principalApplied.toString()).toBe('0.00');
      expect(result.remainder.toString()).toBe('0.00');
    });
  });

  describe('exact allocation order: fees -> penalty -> interest -> principal', () => {
    it('fills each tier completely before moving to the next, in the documented order', () => {
      // A payment that exactly covers fees + penalty + part of interest.
      const result = PaymentAllocationCalculator.calculate(
        Money.of('150.00'),
        Money.of('20.00'), // feesDue
        Money.of('30.00'), // penaltyDue
        Money.of('200.00'), // interestDue
        Money.of('500.00'), // principalDue
      );

      // 150 - 20 (fees) - 30 (penalty) = 100 left for interest; interest
      // due is 200, so only 100 applied, nothing reaches principal.
      expect(result.feesApplied.toString()).toBe('20.00');
      expect(result.penaltyApplied.toString()).toBe('30.00');
      expect(result.interestApplied.toString()).toBe('100.00');
      expect(result.principalApplied.toString()).toBe('0.00');
      expect(result.remainder.toString()).toBe('0.00');
    });
  });

  describe('partial payment scenarios', () => {
    it('a payment smaller than the first tier (fees) applies only to fees, nothing further', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('5.00'),
        Money.of('20.00'), // feesDue
        Money.of('30.00'), // penaltyDue
        Money.of('200.00'), // interestDue
        Money.of('500.00'), // principalDue
      );

      expect(result.feesApplied.toString()).toBe('5.00');
      expect(result.penaltyApplied.toString()).toBe('0.00');
      expect(result.interestApplied.toString()).toBe('0.00');
      expect(result.principalApplied.toString()).toBe('0.00');
      expect(result.remainder.toString()).toBe('0.00');
    });

    it('a payment covering fees, penalty, and interest exactly leaves nothing for principal', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('250.00'),
        Money.of('20.00'),
        Money.of('30.00'),
        Money.of('200.00'),
        Money.of('500.00'),
      );

      expect(result.feesApplied.toString()).toBe('20.00');
      expect(result.penaltyApplied.toString()).toBe('30.00');
      expect(result.interestApplied.toString()).toBe('200.00');
      expect(result.principalApplied.toString()).toBe('0.00');
      expect(result.remainder.toString()).toBe('0.00');
    });
  });

  describe('exact payment scenario', () => {
    it('a payment matching the total due exactly fills every tier, remainder is zero', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('750.00'), // 20 + 30 + 200 + 500
        Money.of('20.00'),
        Money.of('30.00'),
        Money.of('200.00'),
        Money.of('500.00'),
      );

      expect(result.feesApplied.toString()).toBe('20.00');
      expect(result.penaltyApplied.toString()).toBe('30.00');
      expect(result.interestApplied.toString()).toBe('200.00');
      expect(result.principalApplied.toString()).toBe('500.00');
      expect(result.remainder.toString()).toBe('0.00');
    });
  });

  describe('overpayment / remainder behavior', () => {
    it('a payment exceeding every tier fills all four completely and surfaces the excess as remainder — not an invented disposition', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('1000.00'), // 750 total due + 250 excess
        Money.of('20.00'),
        Money.of('30.00'),
        Money.of('200.00'),
        Money.of('500.00'),
      );

      expect(result.feesApplied.toString()).toBe('20.00');
      expect(result.penaltyApplied.toString()).toBe('30.00');
      expect(result.interestApplied.toString()).toBe('200.00');
      expect(result.principalApplied.toString()).toBe('500.00');
      expect(result.remainder.toString()).toBe('250.00');
    });

    it('a payment against an installment with all-zero dues returns the full amount as remainder', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('300.00'),
        Money.of('0.00'),
        Money.of('0.00'),
        Money.of('0.00'),
        Money.of('0.00'),
      );

      expect(result.feesApplied.toString()).toBe('0.00');
      expect(result.penaltyApplied.toString()).toBe('0.00');
      expect(result.interestApplied.toString()).toBe('0.00');
      expect(result.principalApplied.toString()).toBe('0.00');
      expect(result.remainder.toString()).toBe('300.00');
    });
  });

  describe('zero-value cases', () => {
    it('a zero payment applies nothing to any tier and leaves a zero remainder (valid, not an error)', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('0.00'),
        Money.of('20.00'),
        Money.of('30.00'),
        Money.of('200.00'),
        Money.of('500.00'),
      );

      expect(result.feesApplied.toString()).toBe('0.00');
      expect(result.penaltyApplied.toString()).toBe('0.00');
      expect(result.interestApplied.toString()).toBe('0.00');
      expect(result.principalApplied.toString()).toBe('0.00');
      expect(result.remainder.toString()).toBe('0.00');
    });

    it('a zero due amount in one tier is simply skipped over (no amount applied there)', () => {
      const result = PaymentAllocationCalculator.calculate(
        Money.of('700.00'),
        Money.of('0.00'), // feesDue = 0
        Money.of('0.00'), // penaltyDue = 0
        Money.of('200.00'),
        Money.of('500.00'),
      );

      expect(result.feesApplied.toString()).toBe('0.00');
      expect(result.penaltyApplied.toString()).toBe('0.00');
      expect(result.interestApplied.toString()).toBe('200.00');
      expect(result.principalApplied.toString()).toBe('500.00');
      expect(result.remainder.toString()).toBe('0.00');
    });
  });

  describe('validation', () => {
    it('rejects a negative paymentAmount', () => {
      expect(() =>
        PaymentAllocationCalculator.calculate(Money.of('-10.00'), Money.of('0'), Money.of('0'), Money.of('0'), Money.of('0')),
      ).toThrow(InvalidPaymentAllocationInputError);
    });

    it.each([
      ['feesDue', ['-1.00', '0', '0', '0']],
      ['penaltyDue', ['0', '-1.00', '0', '0']],
      ['interestDue', ['0', '0', '-1.00', '0']],
      ['principalDue', ['0', '0', '0', '-1.00']],
    ])('rejects a negative %s', (_label, [fees, penalty, interest, principal]) => {
      expect(() =>
        PaymentAllocationCalculator.calculate(
          Money.of('100.00'),
          Money.of(fees as string),
          Money.of(penalty as string),
          Money.of(interest as string),
          Money.of(principal as string),
        ),
      ).toThrow(InvalidPaymentAllocationInputError);
    });
  });
});
