import { describe, expect, it } from 'vitest';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { AppliedFee } from '@modules/loan-account/domain/AppliedFee';
import { InvalidStatusTransitionError } from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';
import { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';

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

  // Milestone 9.1 checkpoint 5 / ADR-optimistic-concurrency: version is
  // hydrated from the persisted row on read; checkpoint 6 is what actually
  // consults/increments it on write (see PrismaLoanAccountRepository).
  it('create() starts at version 0', () => {
    const loan = createLoanAccount();
    expect(loan.version).toBe(0);
  });

  // Milestone 9.1 checkpoint 6: the repository's create-vs-conditional-
  // update branch depends on this flag being correct for both factories.
  describe('isNew (checkpoint 6: repository create-vs-update routing)', () => {
    it('create() produces a new, never-yet-persisted aggregate', () => {
      const loan = createLoanAccount();
      expect(loan.isNew).toBe(true);
    });

    it('reconstitute() produces an existing aggregate, not new', () => {
      const created = createLoanAccount();
      const reconstituted = LoanAccount.reconstitute({
        id: created.id,
        loanCode: created.loanCode,
        borrowerId: created.borrowerId,
        loanProductVersionId: created.loanProductVersionId,
        branchId: created.branchId,
        loanOfficerId: created.loanOfficerId,
        status: created.status,
        principalAmount: created.principalAmount,
        balances: created.balances,
        interestRate: created.interestRate,
        addOnInterestRate: created.addOnInterestRate,
        contractualInterestRate: created.contractualInterestRate,
        installmentCount: created.installmentCount,
        repaymentPeriodUnit: created.repaymentPeriodUnit,
        gracePeriodDays: created.gracePeriodDays,
        approvedAt: created.approvedAt,
        approvedByUserId: created.approvedByUserId,
        activatedAt: created.activatedAt,
        closedAt: created.closedAt,
        closedReason: created.closedReason,
        legacyId: created.legacyId,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        appliedFees: [...created.appliedFees],
        coBorrowerIds: [...created.coBorrowerIds],
        version: 3,
      });

      expect(reconstituted.isNew).toBe(false);
      expect(reconstituted.version).toBe(3);
    });
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

  // Milestone 9.1 checkpoint 7 / ADR-032: activation is disbursement — the
  // caller (future ActivateLoanUseCase, CP8) supplies already-computed
  // totals; this method only performs the mechanical transition + balance
  // assignment.
  describe('activate', () => {
    function approvedLoan() {
      const loan = createLoanAccount();
      loan.approve('officer-1');
      return loan;
    }

    it('transitions APPROVED -> ACTIVE and records activatedAt', () => {
      const loan = approvedLoan();
      loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00') });
      expect(loan.status).toBe('ACTIVE');
      expect(loan.activatedAt).toBeInstanceOf(Date);
    });

    it('sets balance = due and paid = zero for principal/interest from the supplied input', () => {
      const loan = approvedLoan();
      loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00') });

      expect(loan.balances.principalDue.equals(Money.of('10000.00'))).toBe(true);
      expect(loan.balances.principalBalance.equals(Money.of('10000.00'))).toBe(true);
      expect(loan.balances.principalPaid.isZero()).toBe(true);
      expect(loan.balances.interestDue.equals(Money.of('500.00'))).toBe(true);
      expect(loan.balances.interestBalance.equals(Money.of('500.00'))).toBe(true);
      expect(loan.balances.interestPaid.isZero()).toBe(true);
    });

    it('defaults feesDue/penaltyDue to zero when omitted', () => {
      const loan = approvedLoan();
      loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00') });

      expect(loan.balances.feesDue.isZero()).toBe(true);
      expect(loan.balances.feesBalance.isZero()).toBe(true);
      expect(loan.balances.penaltyDue.isZero()).toBe(true);
      expect(loan.balances.penaltyBalance.isZero()).toBe(true);
    });

    it('honors an explicitly supplied feesDue', () => {
      const loan = approvedLoan();
      loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00'), feesDue: Money.of('250.00') });

      expect(loan.balances.feesDue.equals(Money.of('250.00'))).toBe(true);
      expect(loan.balances.feesBalance.equals(Money.of('250.00'))).toBe(true);
    });

    it('cannot activate a loan that has not been approved', () => {
      const loan = createLoanAccount();
      expect(() => loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00') })).toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('cannot activate an already-active loan', () => {
      const loan = approvedLoan();
      loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00') });
      expect(() => loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00') })).toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  // Milestone 9.1 checkpoint 7 / ADR-009: mechanical balance-effect primitive
  // — deciding the split is PaymentAllocationService's (CP4) job, not this
  // method's.
  describe('applyPayment', () => {
    function activeLoan() {
      const loan = createLoanAccount();
      loan.approve('officer-1');
      loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00'), feesDue: Money.of('100.00') });
      return loan;
    }

    it('increases paid and decreases balance for each supplied component, leaving due untouched', () => {
      const loan = activeLoan();
      loan.applyPayment(
        TransactionComponents.of({
          principalComponent: Money.of('900.00'),
          interestComponent: Money.of('50.00'),
          feesComponent: Money.of('100.00'),
        }),
      );

      expect(loan.balances.principalPaid.equals(Money.of('900.00'))).toBe(true);
      expect(loan.balances.principalBalance.equals(Money.of('9100.00'))).toBe(true);
      expect(loan.balances.principalDue.equals(Money.of('10000.00'))).toBe(true);

      expect(loan.balances.interestPaid.equals(Money.of('50.00'))).toBe(true);
      expect(loan.balances.interestBalance.equals(Money.of('450.00'))).toBe(true);
      expect(loan.balances.interestDue.equals(Money.of('500.00'))).toBe(true);

      expect(loan.balances.feesPaid.equals(Money.of('100.00'))).toBe(true);
      expect(loan.balances.feesBalance.isZero()).toBe(true);
      expect(loan.balances.feesDue.equals(Money.of('100.00'))).toBe(true);
    });

    it('accumulates across multiple calls rather than replacing prior paid/balance amounts', () => {
      const loan = activeLoan();
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('400.00') }));
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('600.00') }));

      expect(loan.balances.principalPaid.equals(Money.of('1000.00'))).toBe(true);
      expect(loan.balances.principalBalance.equals(Money.of('9000.00'))).toBe(true);
    });

    it('allows a resulting negative balance (overpayment) rather than rejecting it', () => {
      const loan = activeLoan();
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('10500.00') }));

      expect(loan.balances.principalBalance.isNegative()).toBe(true);
      expect(loan.balances.principalBalance.equals(Money.of('-500.00'))).toBe(true);
    });

    it('sets updatedAt to the supplied paidAt', () => {
      const loan = activeLoan();
      const paidAt = new Date('2026-08-01T00:00:00.000Z');
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('100.00') }), paidAt);

      expect(loan.updatedAt).toEqual(paidAt);
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
