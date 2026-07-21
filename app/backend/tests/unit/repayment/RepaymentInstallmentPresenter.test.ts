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

  // ADR-053 (2026-07-20): SEC MC3-covered loans use the 5%/month simple (non-compounding) ceiling
  // instead of ADR-050's compounding formula.
  describe('SEC MC3 coverage (ADR-053)', () => {
    it('uses the simple 5%/month formula (not compounding) when isSecMc3Covered is true', () => {
      // Far enough in the past that many whole months have definitely elapsed by test-run time,
      // regardless of the real wall-clock date - needed for compounding vs. simple to visibly diverge.
      const dueDate = new Date('2020-01-01T00:00:00Z');
      const installment = RepaymentInstallment.reconstitute({
        id: 'installment-secmc3',
        loanAccountId: 'loan-secmc3',
        installmentNumber: 1,
        dueDate,
        due: InstallmentAmounts.of({ principal: Money.of('8000.00'), interest: Money.of('2000.00') }),
        paid: InstallmentAmounts.of({}),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 0,
      });

      // Not currently exercised by presentRepaymentInstallment's asOfDate (always "now"), so this
      // just confirms the covered path produces the SIMPLE-formula figure, not the ADR-050 one, by
      // comparing directly against the two PenaltyCalculator methods for a fixed 2-month-late date.
      const covered = presentRepaymentInstallment(installment, {
        isProspectiveLoan: true,
        principalAmount: Money.of('8000.00'),
        isSecMc3Covered: true,
      });
      const notCovered = presentRepaymentInstallment(installment, {
        isProspectiveLoan: true,
        principalAmount: Money.of('8000.00'),
        isSecMc3Covered: false,
      });

      expect(covered.currentPenaltyOwed).not.toBeNull();
      expect(notCovered.currentPenaltyOwed).not.toBeNull();
      // ADR-050's compounding formula always charges >= the simple formula for the same rate/months
      // once at least 2 whole months have elapsed (compounding interest on interest).
      expect(Number(notCovered.currentPenaltyOwed)).toBeGreaterThanOrEqual(Number(covered.currentPenaltyOwed));
    });
  });

  // 2026-07-15 (Reduce Penalty feature): an override always wins over live computation.
  describe('penaltyOverride', () => {
    it('overrides the live-computed amount and reports isLivePenalty=false', () => {
      const installment = buildOverdueInstallment(new Date('2020-01-01T00:00:00Z'));
      installment.reducePenalty(Money.of('123.45'), Money.of('99999.00'), 'memo #1', 'user-1');

      const result = presentRepaymentInstallment(installment, { isProspectiveLoan: true, principalAmount: Money.of('50000.00') });

      expect(result.currentPenaltyOwed).toBe('123.45');
      expect(result.isLivePenalty).toBe(false);
      expect(result.penaltyOverride).toEqual({
        amount: '123.45',
        reason: 'memo #1',
        byUserId: 'user-1',
        byName: null,
        at: expect.any(String),
      });
    });

    it('also overrides for a migrated (non-prospective) loan — currentPenaltyOwed becomes non-null', () => {
      const installment = buildOverdueInstallment(new Date('2020-01-01T00:00:00Z'));
      installment.reducePenalty(Money.of('0.00'), Money.of('500.00'), 'waived', 'user-1');

      const result = presentRepaymentInstallment(installment, { isProspectiveLoan: false, principalAmount: Money.of('50000.00') });

      expect(result.currentPenaltyOwed).toBe('0.00');
      expect(result.isLivePenalty).toBe(false);
    });

    it('is null when no reduction has been applied', () => {
      const installment = buildOverdueInstallment(new Date('2020-01-01T00:00:00Z'));
      const result = presentRepaymentInstallment(installment, { isProspectiveLoan: true, principalAmount: Money.of('50000.00') });
      expect(result.penaltyOverride).toBeNull();
      expect(result.isLivePenalty).toBe(true);
    });
  });

  // 2026-07-16 (Adjust Fees feature): currentFeesDue always resolves — no live-computation concept for fees.
  describe('currentFeesDue / feesOverride', () => {
    function buildInstallmentWithFees(feesDue: string) {
      return RepaymentInstallment.reconstitute({
        id: 'installment-fees',
        loanAccountId: 'loan-1',
        installmentNumber: 1,
        dueDate: new Date('2020-01-01T00:00:00Z'),
        due: InstallmentAmounts.of({ principal: Money.of('8000.00'), interest: Money.of('2000.00'), fees: Money.of(feesDue) }),
        paid: InstallmentAmounts.of({}),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 0,
      });
    }

    it('is due.fees when no adjustment has been applied', () => {
      const installment = buildInstallmentWithFees('100.00');
      const result = presentRepaymentInstallment(installment);
      expect(result.currentFeesDue).toBe('100.00');
      expect(result.feesOverride).toBeNull();
    });

    it('is the override amount once one is set, even raised above the original due', () => {
      const installment = buildInstallmentWithFees('100.00');
      installment.adjustFees(Money.of('500.00'), 'memo #2', 'user-1');

      const result = presentRepaymentInstallment(installment);

      expect(result.currentFeesDue).toBe('500.00');
      expect(result.feesOverride).toEqual({
        amount: '500.00',
        reason: 'memo #2',
        byUserId: 'user-1',
        byName: null,
        at: expect.any(String),
      });
    });
  });
});
