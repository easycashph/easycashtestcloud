import { describe, expect, it } from 'vitest';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';

function createInstallment(dueDate: Date) {
  return RepaymentInstallment.create({
    loanAccountId: 'loan-1',
    installmentNumber: 1,
    dueDate,
    due: InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }),
  });
}

describe('RepaymentInstallment (ADR-042 §7: independent aggregate)', () => {
  it('create() starts with zero paid amounts', () => {
    const installment = createInstallment(new Date(Date.now() + 86_400_000));
    expect(installment.paid.total().isZero()).toBe(true);
  });

  describe('status (REPAY-3: always derived, never independently settable)', () => {
    it('is PENDING before the due date with no payment', () => {
      const installment = createInstallment(new Date(Date.now() + 86_400_000));
      expect(installment.status).toBe('PENDING');
    });

    it('is PARTIALLY_PAID when some but not all is paid, before the due date', () => {
      const installment = createInstallment(new Date(Date.now() + 86_400_000));
      installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('400.00') }));
      expect(installment.status).toBe('PARTIALLY_PAID');
    });

    it('is PAID once total paid reaches total due', () => {
      const installment = createInstallment(new Date(Date.now() + 86_400_000));
      installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }));
      expect(installment.status).toBe('PAID');
    });

    it('is LATE once overdue with an outstanding balance, even after a partial payment', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('100.00') }));
      expect(installment.status).toBe('LATE');
    });

    it('is PAID even after the due date if fully paid — PAID takes precedence over LATE', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }));
      expect(installment.status).toBe('PAID');
    });

    it('has no setStatus method anywhere', () => {
      const installment = createInstallment(new Date());
      expect((installment as unknown as Record<string, unknown>).setStatus).toBeUndefined();
    });
  });

  describe('recordPayment (single-installment primitive, not the allocation algorithm)', () => {
    it('accumulates across multiple calls and updates lastPaidAt', () => {
      const installment = createInstallment(new Date(Date.now() + 86_400_000));
      installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('300.00') }), new Date('2026-01-01'));
      installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('200.00') }), new Date('2026-01-15'));

      expect(installment.paid.principal.equals(Money.of('500.00'))).toBe(true);
      expect(installment.lastPaidAt).toEqual(new Date('2026-01-15'));
    });
  });

  it('due amounts are immutable — RepaymentInstallment exposes no method that changes them', () => {
    const installment = createInstallment(new Date());
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(installment));
    expect(methodNames).not.toContain('setDue');
    expect(methodNames).not.toContain('updateDue');
  });
});
