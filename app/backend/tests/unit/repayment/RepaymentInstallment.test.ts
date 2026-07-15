import { describe, expect, it } from 'vitest';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';
import { PenaltyAlreadyPaidError, PenaltyReductionExceedsCurrentAmountError } from '@modules/repayment/domain/errors/RepaymentDomainErrors';

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

  // Milestone 9.1 checkpoint 5 / ADR-048-optimistic-concurrency: version is
  // hydrated from the persisted row on read; checkpoint 6 is what actually
  // consults/increments it on write (see PrismaRepaymentInstallmentRepository).
  it('create() starts at version 0', () => {
    const installment = createInstallment(new Date(Date.now() + 86_400_000));
    expect(installment.version).toBe(0);
  });

  // Milestone 9.1 checkpoint 6: the repository's create-vs-conditional-
  // update branch depends on this flag being correct for both factories.
  describe('isNew (checkpoint 6: repository create-vs-update routing)', () => {
    it('create() produces a new, never-yet-persisted aggregate', () => {
      const installment = createInstallment(new Date(Date.now() + 86_400_000));
      expect(installment.isNew).toBe(true);
    });

    it('reconstitute() produces an existing aggregate, not new', () => {
      const created = createInstallment(new Date(Date.now() + 86_400_000));
      const reconstituted = RepaymentInstallment.reconstitute({
        id: created.id,
        loanAccountId: created.loanAccountId,
        installmentNumber: created.installmentNumber,
        dueDate: created.dueDate,
        due: created.due,
        paid: created.paid,
        lastPaidAt: created.lastPaidAt,
        legacyId: created.legacyId,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        version: 5,
      });

      expect(reconstituted.isNew).toBe(false);
      expect(reconstituted.version).toBe(5);
    });
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

  // 2026-07-15 (Reduce Penalty feature, user-confirmed business rules).
  describe('reducePenalty', () => {
    it('sets a penaltyOverride that freezes the amount', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      installment.reducePenalty(Money.of('500.00'), Money.of('1000.00'), 'Approved by memo #123', 'user-1');

      expect(installment.penaltyOverride?.amount.equals(Money.of('500.00'))).toBe(true);
      expect(installment.penaltyOverride?.reason).toBe('Approved by memo #123');
      expect(installment.penaltyOverride?.byUserId).toBe('user-1');
    });

    it('allows reducing all the way to zero (full waive)', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      installment.reducePenalty(Money.ZERO, Money.of('1000.00'), 'Full waive per memo', 'user-1');

      expect(installment.penaltyOverride?.amount.isZero()).toBe(true);
    });

    it('rejects a new amount above the current penalty — a reduction can only lower it', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      expect(() => installment.reducePenalty(Money.of('1500.00'), Money.of('1000.00'), 'reason', 'user-1')).toThrow(
        PenaltyReductionExceedsCurrentAmountError,
      );
    });

    it('rejects a negative new amount', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      expect(() => installment.reducePenalty(Money.of('-1.00'), Money.of('1000.00'), 'reason', 'user-1')).toThrow(
        PenaltyReductionExceedsCurrentAmountError,
      );
    });

    it('rejects reducing an installment whose penalty has already been paid', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      installment.recordPayment(InstallmentAmounts.of({ penalty: Money.of('50.00') }));
      expect(() => installment.reducePenalty(Money.of('0.00'), Money.of('1000.00'), 'reason', 'user-1')).toThrow(
        PenaltyAlreadyPaidError,
      );
    });

    it('a later reduction overwrites the earlier override (latest wins)', () => {
      const installment = createInstallment(new Date(Date.now() - 86_400_000));
      installment.reducePenalty(Money.of('500.00'), Money.of('1000.00'), 'first reduction', 'user-1');
      installment.reducePenalty(Money.of('200.00'), Money.of('500.00'), 'second reduction', 'user-2');

      expect(installment.penaltyOverride?.amount.equals(Money.of('200.00'))).toBe(true);
      expect(installment.penaltyOverride?.reason).toBe('second reduction');
    });
  });
});
