import { describe, expect, it } from 'vitest';
import { presentRepaymentInstallment } from '@modules/repayment/interface/http/presenters/RepaymentInstallmentPresenter';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';

// ADR-050 / CALCULATION_ENGINE_SPEC.md §12 — live "currentPenaltyOwed" field, prospective loans only.
function buildOverdueInstallment(dueDate: Date) {
  return RepaymentInstallment.reconstitute({
    id: 'installment-1',
    loanAccountId: 'loan-1',
    installmentNumber: 1,
    dueDate,
    due: InstallmentAmounts.of({ principal: Money.of('8000.00'), interest: Money.of('2000.00') }),
    paid: InstallmentAmounts.of({}),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  });
}

describe('presentRepaymentInstallment — currentPenaltyOwed (ADR-050 / CALC-SPEC §12)', () => {
  it('is null when no penalty context is supplied at all', () => {
    const installment = buildOverdueInstallment(new Date('2020-01-01T00:00:00Z'));
    const result = presentRepaymentInstallment(installment);
    expect(result.currentPenaltyOwed).toBeNull();
  });

  it('is null for a migrated (non-prospective) loan, even if genuinely overdue', () => {
    const installment = buildOverdueInstallment(new Date('2020-01-01T00:00:00Z'));
    const result = presentRepaymentInstallment(installment, { isProspectiveLoan: false, principalAmount: Money.of('50000.00') });
    expect(result.currentPenaltyOwed).toBeNull();
  });

  it('is null once the installment is fully PAID, regardless of how overdue it once was', () => {
    const installment = RepaymentInstallment.reconstitute({
      id: 'installment-1',
      loanAccountId: 'loan-1',
      installmentNumber: 1,
      dueDate: new Date('2020-01-01T00:00:00Z'),
      due: InstallmentAmounts.of({ principal: Money.of('8000.00'), interest: Money.of('2000.00') }),
      paid: InstallmentAmounts.of({ principal: Money.of('8000.00'), interest: Money.of('2000.00') }),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
    const result = presentRepaymentInstallment(installment, { isProspectiveLoan: true, principalAmount: Money.of('50000.00') });
    expect(result.currentPenaltyOwed).toBeNull();
  });

  it('computes the standard 10% tier for a prospective loan with principal above ₱10,000', () => {
    // Due 2026-07-01, "now" is whatever the test runs at — use a due date far enough in the past
    // that at least 3 whole months have definitely elapsed by the time this test runs.
    const installment = buildOverdueInstallment(new Date('2020-01-01T00:00:00Z'));
    const result = presentRepaymentInstallment(installment, { isProspectiveLoan: true, principalAmount: Money.of('50000.00') });
    expect(result.currentPenaltyOwed).not.toBeNull();
    expect(Number(result.currentPenaltyOwed)).toBeGreaterThan(0);
  });

  it('uses the 5% tier for a prospective loan with principal at or below ₱10,000, producing a smaller penalty than the 10% tier for the same overdue amount and lateness', () => {
    const dueDate = new Date('2020-01-01T00:00:00Z');
    const smallLoanInstallment = RepaymentInstallment.reconstitute({
      id: 'installment-small',
      loanAccountId: 'loan-2',
      installmentNumber: 1,
      dueDate,
      due: InstallmentAmounts.of({ principal: Money.of('8000.00'), interest: Money.of('2000.00') }),
      paid: InstallmentAmounts.of({}),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
    const largeLoanInstallment = RepaymentInstallment.reconstitute({
      id: 'installment-large',
      loanAccountId: 'loan-3',
      installmentNumber: 1,
      dueDate,
      due: InstallmentAmounts.of({ principal: Money.of('8000.00'), interest: Money.of('2000.00') }),
      paid: InstallmentAmounts.of({}),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });

    const smallLoanResult = presentRepaymentInstallment(smallLoanInstallment, {
      isProspectiveLoan: true,
      principalAmount: Money.of('10000.00'), // at the threshold -> 5% tier
    });
    const largeLoanResult = presentRepaymentInstallment(largeLoanInstallment, {
      isProspectiveLoan: true,
      principalAmount: Money.of('10000.01'), // just above the threshold -> 10% tier
    });

    expect(Number(smallLoanResult.currentPenaltyOwed)).toBeGreaterThan(0);
    expect(Number(largeLoanResult.currentPenaltyOwed)).toBeGreaterThan(Number(smallLoanResult.currentPenaltyOwed));
  });

  it('is zero (not null) within the grace period even for a prospective loan', () => {
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() - 1); // due yesterday -> still within the 3-day grace period
    const installment = buildOverdueInstallment(dueDate);
    const result = presentRepaymentInstallment(installment, { isProspectiveLoan: true, principalAmount: Money.of('50000.00') });
    expect(result.currentPenaltyOwed).toBe('0.00');
  });
});
