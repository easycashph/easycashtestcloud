import { describe, expect, it } from 'vitest';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { AppliedFee } from '@modules/loan-account/domain/AppliedFee';
import { InvalidStatusTransitionError } from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';

function createLoanAccount() {
  return LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 12,
  });
}

describe('LoanAccount', () => {
  it('create() starts PENDING_APPROVAL with zeroed balances', () => {
    const loan = createLoanAccount();
    expect(loan.status).toBe('PENDING_APPROVAL');
    expect(loan.balances.principalBalance.isZero()).toBe(true);
  });

  describe('approve (ADR-032: approval only, never disbursement/activation)', () => {
    it('transitions PENDING_APPROVAL -> APPROVED and records approver/timestamp', () => {
      const loan = createLoanAccount();
      loan.approve('officer-1');
      expect(loan.status).toBe('APPROVED');
      expect(loan.approvedByUserId).toBe('officer-1');
      expect(loan.approvedAt).toBeInstanceOf(Date);
    });

    it('does NOT create any transaction, schedule, or balance change (out of scope for Milestone 7)', () => {
      const loan = createLoanAccount();
      loan.approve('officer-1');
      expect(loan.balances.principalBalance.isZero()).toBe(true);
      expect(loan.activatedAt).toBeUndefined();
    });

    it('cannot approve an already-approved loan', () => {
      const loan = createLoanAccount();
      loan.approve('officer-1');
      expect(() => loan.approve('officer-1')).toThrow(InvalidStatusTransitionError);
    });

    it('cannot approve a rejected loan', () => {
      const loan = createLoanAccount();
      loan.reject('Insufficient documents');
      expect(() => loan.approve('officer-1')).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reject', () => {
    it('transitions PENDING_APPROVAL -> CLOSED_REJECTED and records the reason', () => {
      const loan = createLoanAccount();
      loan.reject('Insufficient income');
      expect(loan.status).toBe('CLOSED_REJECTED');
      expect(loan.closedReason).toBe('Insufficient income');
      expect(loan.closedAt).toBeInstanceOf(Date);
    });
  });

  describe('status transition guard (LA-2 / ADR-011)', () => {
    it('CLOSED_REJECTED is terminal — no further transitions allowed', () => {
      const loan = createLoanAccount();
      loan.reject();
      expect(() => loan.approve('officer-1')).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('appliedFees (FEE-4: immutable once applied, small bounded collection)', () => {
    it('addAppliedFee appends without replacing existing fees', () => {
      const loan = createLoanAccount();
      loan.addAppliedFee(AppliedFee.create({ feeRuleId: 'fee-1', amount: Money.of('500.00') }));
      loan.addAppliedFee(AppliedFee.create({ feeRuleId: 'fee-2', amount: Money.of('200.00') }));
      expect(loan.appliedFees).toHaveLength(2);
    });
  });

  describe('co-borrower attachment', () => {
    it('attachCoBorrower is idempotent', () => {
      const loan = createLoanAccount();
      loan.attachCoBorrower('cb-1');
      loan.attachCoBorrower('cb-1');
      expect(loan.coBorrowerIds).toEqual(['cb-1']);
    });

    it('detachCoBorrower removes exactly the given id', () => {
      const loan = createLoanAccount();
      loan.attachCoBorrower('cb-1');
      loan.attachCoBorrower('cb-2');
      loan.detachCoBorrower('cb-1');
      expect(loan.coBorrowerIds).toEqual(['cb-2']);
    });
  });
});
