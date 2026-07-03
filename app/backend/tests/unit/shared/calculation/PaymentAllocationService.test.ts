import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { PaymentAllocationService, type AllocatableInstallment } from '@shared/domain/calculation/PaymentAllocationService';
import { InvalidPaymentAllocationInputError } from '@shared/domain/calculation/errors/CalculationDomainErrors';

function installment(id: string, fees: string, penalty: string, interest: string, principal: string): AllocatableInstallment {
  return {
    id,
    feesDue: Money.of(fees),
    penaltyDue: Money.of(penalty),
    interestDue: Money.of(interest),
    principalDue: Money.of(principal),
  };
}

describe('PaymentAllocationService (cross-installment orchestration, CALC-SPEC §5 Edge Cases)', () => {
  it('applies a payment that exactly covers the first installment and stops, leaving the second untouched', () => {
    const installments = [
      installment('inst-1', '0', '0', '100.00', '400.00'), // total 500
      installment('inst-2', '0', '0', '100.00', '400.00'),
    ];

    const result = PaymentAllocationService.allocate(Money.of('500.00'), installments);

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]?.installmentId).toBe('inst-1');
    expect(result.allocations[0]?.interestApplied.toString()).toBe('100.00');
    expect(result.allocations[0]?.principalApplied.toString()).toBe('400.00');
    // inst-2 receives nothing — the payment was exhausted by inst-1.
    expect(result.allocations[1]?.interestApplied.toString()).toBe('0.00');
    expect(result.allocations[1]?.principalApplied.toString()).toBe('0.00');
    expect(result.remainder.toString()).toBe('0.00');
  });

  it('carries the remainder from one installment into the next, in the order supplied', () => {
    const installments = [
      installment('inst-1', '0', '0', '50.00', '100.00'), // total 150
      installment('inst-2', '0', '0', '50.00', '100.00'), // total 150
    ];

    const result = PaymentAllocationService.allocate(Money.of('200.00'), installments);

    expect(result.allocations[0]?.interestApplied.toString()).toBe('50.00');
    expect(result.allocations[0]?.principalApplied.toString()).toBe('100.00');
    // 200 - 150 = 50 carries into inst-2, filling its interest tier only.
    expect(result.allocations[1]?.interestApplied.toString()).toBe('50.00');
    expect(result.allocations[1]?.principalApplied.toString()).toBe('0.00');
    expect(result.remainder.toString()).toBe('0.00');
  });

  it('surfaces the excess as remainder once every installment supplied is fully paid — never invents a disposition for it', () => {
    const installments = [installment('inst-1', '0', '0', '50.00', '100.00')]; // total 150

    const result = PaymentAllocationService.allocate(Money.of('200.00'), installments);

    expect(result.allocations[0]?.interestApplied.toString()).toBe('50.00');
    expect(result.allocations[0]?.principalApplied.toString()).toBe('100.00');
    expect(result.remainder.toString()).toBe('50.00');
  });

  it('returns an all-zero allocation and the full amount as remainder for an empty installment list', () => {
    const result = PaymentAllocationService.allocate(Money.of('100.00'), []);

    expect(result.allocations).toEqual([]);
    expect(result.remainder.toString()).toBe('100.00');
  });

  it('applies fees -> penalty -> interest -> principal order independently within each installment', () => {
    const installments = [installment('inst-1', '10.00', '20.00', '30.00', '40.00')]; // total 100

    const result = PaymentAllocationService.allocate(Money.of('35.00'), installments);

    // 35 - 10 (fees) - 20 (penalty) = 5 left for interest; interest due
    // is 30, so only 5 applied, nothing reaches principal.
    expect(result.allocations[0]?.feesApplied.toString()).toBe('10.00');
    expect(result.allocations[0]?.penaltyApplied.toString()).toBe('20.00');
    expect(result.allocations[0]?.interestApplied.toString()).toBe('5.00');
    expect(result.allocations[0]?.principalApplied.toString()).toBe('0.00');
    expect(result.remainder.toString()).toBe('0.00');
  });

  describe('validation', () => {
    it('rejects a zero paymentAmount (not a real payment, per CALC-SPEC §5)', () => {
      expect(() => PaymentAllocationService.allocate(Money.of('0.00'), [installment('inst-1', '0', '0', '10.00', '0')])).toThrow(
        InvalidPaymentAllocationInputError,
      );
    });

    it('rejects a negative paymentAmount', () => {
      expect(() =>
        PaymentAllocationService.allocate(Money.of('-50.00'), [installment('inst-1', '0', '0', '10.00', '0')]),
      ).toThrow(InvalidPaymentAllocationInputError);
    });
  });
});
