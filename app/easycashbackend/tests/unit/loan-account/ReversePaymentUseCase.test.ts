import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReversePaymentUseCase } from '@modules/loan-account/application/use-cases/ReversePaymentUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { PaymentAllocation } from '@modules/ledger/domain/PaymentAllocation';
import { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
import {
  NoReversibleAllocationDataError,
  TransactionAlreadyReversedError,
  TransactionNotReversibleError,
} from '@modules/ledger/domain/errors/LedgerDomainErrors';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';
import type { TransactionContext } from '@shared/application/TransactionContext';

function buildActiveLoan(principalDue: string, interestDue: string) {
  const loan = LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of(principalDue),
    interestRate: Percentage.of('2.5'),
    installmentCount: 3,
    firstRepaymentDate: new Date('2026-08-15'),
  });
  loan.approve('officer-1');
  loan.activate({ principalDue: Money.of(principalDue), interestDue: Money.of(interestDue) });
  return loan;
}

function buildInstallment(
  installmentNumber: number,
  due: { principal: string; interest: string },
  paid: { principal: string; interest: string },
) {
  return RepaymentInstallment.reconstitute({
    id: `installment-${installmentNumber}`,
    loanAccountId: 'loan-1',
    installmentNumber,
    dueDate: new Date('2026-08-15'),
    due: InstallmentAmounts.of({ principal: Money.of(due.principal), interest: Money.of(due.interest) }),
    paid: InstallmentAmounts.of({ principal: Money.of(paid.principal), interest: Money.of(paid.interest) }),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  });
}

function buildRepaymentTransaction(overrides: Partial<{ id: string; amount: string; principal: string; interest: string }> = {}) {
  return LoanTransaction.reconstitute({
    id: overrides.id ?? 'txn-1',
    loanAccountId: 'loan-1',
    type: 'REPAYMENT',
    amount: Money.of(overrides.amount ?? '1200.00'),
    components: TransactionComponents.of({
      principalComponent: Money.of(overrides.principal ?? '1000.00'),
      interestComponent: Money.of(overrides.interest ?? '200.00'),
    }),
    balanceAfter: Money.of('2000.00'),
    postedByUserId: 'officer-1',
    branchId: 'branch-1',
    entryDate: new Date('2026-08-20'),
    createdAt: new Date('2026-08-20'),
  });
}

const mockCtx = { __brand: 'TransactionContext' } as TransactionContext;

function buildDeps() {
  const loanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn(), save: vi.fn() };
  const repaymentInstallmentRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
  const loanTransactionRepository = {
    findById: vi.fn(),
    findByLoanAccountId: vi.fn(),
    findByReversesTransactionId: vi.fn(),
    create: vi.fn(),
  };
  const paymentAllocationRepository = { createMany: vi.fn(), findByLoanTransactionId: vi.fn() };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn(async (work: (ctx: TransactionContext) => Promise<unknown>) => work(mockCtx)) };

  return {
    loanAccountRepository,
    repaymentInstallmentRepository,
    loanTransactionRepository,
    paymentAllocationRepository,
    financialAuditLogger,
    unitOfWork,
  };
}

describe('ReversePaymentUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(null);
    const useCase = new ReversePaymentUseCase(deps);

    await expect(useCase.execute('missing-loan', 'txn-1', 'mis-1', 'wrong amount')).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the transaction does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    deps.loanTransactionRepository.findById.mockResolvedValue(null);
    const useCase = new ReversePaymentUseCase(deps);

    await expect(useCase.execute('loan-1', 'missing-txn', 'mis-1', 'wrong amount')).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the transaction belongs to a different loan account', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    const foreignTxn = LoanTransaction.reconstitute({
      id: 'txn-1',
      loanAccountId: 'some-other-loan',
      type: 'REPAYMENT',
      amount: Money.of('100.00'),
      components: TransactionComponents.of({ principalComponent: Money.of('100.00') }),
      balanceAfter: Money.of('900.00'),
      branchId: 'branch-1',
      entryDate: new Date(),
      createdAt: new Date(),
    });
    deps.loanTransactionRepository.findById.mockResolvedValue(foreignTxn);
    const useCase = new ReversePaymentUseCase(deps);

    await expect(useCase.execute('loan-1', 'txn-1', 'mis-1', 'wrong amount')).rejects.toThrow(NotFoundError);
  });

  it('rejects reversing a non-REPAYMENT transaction (e.g. DISBURSEMENT)', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    const disbursement = LoanTransaction.reconstitute({
      id: 'txn-1',
      loanAccountId: 'loan-1',
      type: 'DISBURSEMENT',
      amount: Money.of('2000.00'),
      components: TransactionComponents.of({ principalComponent: Money.of('2000.00') }),
      balanceAfter: Money.of('2000.00'),
      branchId: 'branch-1',
      entryDate: new Date(),
      createdAt: new Date(),
    });
    deps.loanTransactionRepository.findById.mockResolvedValue(disbursement);
    const useCase = new ReversePaymentUseCase(deps);

    await expect(useCase.execute('loan-1', 'txn-1', 'mis-1', 'wrong amount')).rejects.toThrow(TransactionNotReversibleError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects reversing a transaction that has already been reversed', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    deps.loanTransactionRepository.findById.mockResolvedValue(buildRepaymentTransaction());
    deps.loanTransactionRepository.findByReversesTransactionId.mockResolvedValue(
      buildRepaymentTransaction({ id: 'txn-1-reversal' }),
    );
    const useCase = new ReversePaymentUseCase(deps);

    await expect(useCase.execute('loan-1', 'txn-1', 'mis-1', 'wrong amount')).rejects.toThrow(TransactionAlreadyReversedError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects reversing a transaction with no recorded PaymentAllocation breakdown (pre-feature transaction)', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    deps.loanTransactionRepository.findById.mockResolvedValue(buildRepaymentTransaction());
    deps.loanTransactionRepository.findByReversesTransactionId.mockResolvedValue(null);
    deps.paymentAllocationRepository.findByLoanTransactionId.mockResolvedValue([]);
    const useCase = new ReversePaymentUseCase(deps);

    await expect(useCase.execute('loan-1', 'txn-1', 'mis-1', 'wrong amount')).rejects.toThrow(NoReversibleAllocationDataError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  describe('happy path', () => {
    it('undoes a single-installment payment exactly: installment paid amounts, loan balances, and a linked REVERSAL transaction', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('2000.00', '300.00');
      // Simulate the original payment's effect already applied, matching inst1's paid state below.
      loan.applyPayment(
        TransactionComponents.of({ principalComponent: Money.of('1000.00'), interestComponent: Money.of('200.00') }),
        new Date('2026-08-20'),
      );
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const original = buildRepaymentTransaction();
      deps.loanTransactionRepository.findById.mockResolvedValue(original);
      deps.loanTransactionRepository.findByReversesTransactionId.mockResolvedValue(null);

      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '200.00' }, { principal: '1000.00', interest: '200.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);

      const allocation = PaymentAllocation.create({
        loanTransactionId: 'txn-1',
        repaymentInstallmentId: 'installment-1',
        principalApplied: Money.of('1000.00'),
        interestApplied: Money.of('200.00'),
        feesApplied: Money.ZERO,
        penaltyApplied: Money.ZERO,
      });
      deps.paymentAllocationRepository.findByLoanTransactionId.mockResolvedValue([allocation]);

      const useCase = new ReversePaymentUseCase(deps);
      const result = await useCase.execute('loan-1', 'txn-1', 'mis-1', 'Cashier entered the wrong amount');

      // Installment is back to fully unpaid.
      expect(inst1.paid.principal.isZero()).toBe(true);
      expect(inst1.paid.interest.isZero()).toBe(true);
      expect(inst1.status).toBe('PENDING');

      // Loan balances are restored to their pre-payment state.
      expect(result.balances.principalPaid.isZero()).toBe(true);
      expect(result.balances.interestPaid.isZero()).toBe(true);
      expect(result.balances.principalBalance.equals(Money.of('2000.00'))).toBe(true);
      expect(result.balances.interestBalance.equals(Money.of('300.00'))).toBe(true);

      // A new REVERSAL transaction, linked to the original, negated amount, carrying the reason.
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
      const reversal = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
      expect(reversal.type).toBe('REVERSAL');
      expect(reversal.reversesTransactionId).toBe('txn-1');
      expect(reversal.amount.equals(Money.of('-1200.00'))).toBe(true);
      expect(reversal.components.principalComponent.equals(Money.of('-1000.00'))).toBe(true);
      expect(reversal.components.interestComponent.equals(Money.of('-200.00'))).toBe(true);
      expect(reversal.comment).toBe('Cashier entered the wrong amount');
      expect(reversal.postedByUserId).toBe('mis-1');

      // Atomicity + audit trail.
      expect(deps.unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, mockCtx);
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith([inst1], mockCtx);
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledWith(reversal, mockCtx);
      expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(expect.anything(), mockCtx);

      const [entry] = deps.financialAuditLogger.log.mock.calls[0] ?? [];
      expect(entry.action).toBe('REVERSE_PAYMENT');
      expect(entry.entityType).toBe('LoanAccount');
      expect(entry.entityId).toBe(loan.id);
      expect(entry.userId).toBe('mis-1');
    });

    it('undoes a payment that spanned multiple installments, negating each one\'s own PaymentAllocation row independently', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('3000.00', '450.00');
      loan.applyPayment(
        TransactionComponents.of({ principalComponent: Money.of('1200.00'), interestComponent: Money.of('100.00') }),
        new Date('2026-08-20'),
      );
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const original = buildRepaymentTransaction({ amount: '1300.00', principal: '1200.00', interest: '100.00' });
      deps.loanTransactionRepository.findById.mockResolvedValue(original);
      deps.loanTransactionRepository.findByReversesTransactionId.mockResolvedValue(null);

      // installment 1 fully paid (1000 principal + 200 interest due, but this payment only
      // covered the last 100 of its interest tier from a prior payment — paid reflects the
      // cumulative state, this transaction's own allocation is the delta it added).
      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '200.00' }, { principal: '1000.00', interest: '200.00' });
      const inst2 = buildInstallment(2, { principal: '1000.00', interest: '150.00' }, { principal: '200.00', interest: '0.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1, inst2]);

      const allocations = [
        PaymentAllocation.create({
          loanTransactionId: 'txn-1',
          repaymentInstallmentId: 'installment-1',
          principalApplied: Money.of('1000.00'),
          interestApplied: Money.of('100.00'),
          feesApplied: Money.ZERO,
          penaltyApplied: Money.ZERO,
        }),
        PaymentAllocation.create({
          loanTransactionId: 'txn-1',
          repaymentInstallmentId: 'installment-2',
          principalApplied: Money.of('200.00'),
          interestApplied: Money.ZERO,
          feesApplied: Money.ZERO,
          penaltyApplied: Money.ZERO,
        }),
      ];
      deps.paymentAllocationRepository.findByLoanTransactionId.mockResolvedValue(allocations);

      const useCase = new ReversePaymentUseCase(deps);
      const result = await useCase.execute('loan-1', 'txn-1', 'mis-1', 'Duplicate entry');

      expect(inst1.paid.principal.isZero()).toBe(true);
      expect(inst1.paid.interest.equals(Money.of('100.00'))).toBe(true);
      expect(inst2.paid.principal.isZero()).toBe(true);
      expect(inst2.paid.interest.isZero()).toBe(true);

      expect(result.balances.principalPaid.isZero()).toBe(true);
      expect(result.balances.interestPaid.isZero()).toBe(true);

      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith(
        expect.arrayContaining([inst1, inst2]),
        mockCtx,
      );
    });

    // 2026-07-16: found via a real client loan (SML-REG_00378) — reversing the payment that had
    // fully settled and auto-closed a loan left it stuck CLOSED with a real nonzero balance.
    it('reopens a CLOSED loan back to ACTIVE when reversing the payment that had fully settled it', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('1000.00', '100.00');
      // The original payment fully settled the loan, which auto-closed it (mirrors what
      // ProcessPaymentUseCase does on isFullyPaid).
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('1000.00'), interestComponent: Money.of('100.00') }));
      loan.close();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const original = buildRepaymentTransaction({ amount: '1100.00', principal: '1000.00', interest: '100.00' });
      deps.loanTransactionRepository.findById.mockResolvedValue(original);
      deps.loanTransactionRepository.findByReversesTransactionId.mockResolvedValue(null);

      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);

      const allocation = PaymentAllocation.create({
        loanTransactionId: 'txn-1',
        repaymentInstallmentId: 'installment-1',
        principalApplied: Money.of('1000.00'),
        interestApplied: Money.of('100.00'),
        feesApplied: Money.ZERO,
        penaltyApplied: Money.ZERO,
      });
      deps.paymentAllocationRepository.findByLoanTransactionId.mockResolvedValue([allocation]);

      const useCase = new ReversePaymentUseCase(deps);
      const result = await useCase.execute('loan-1', 'txn-1', 'mis-1', 'Cashier entered the wrong amount');

      expect(result.status).toBe('ACTIVE');
      expect(result.closedAt).toBeUndefined();
      expect(result.balances.principalBalance.equals(Money.of('1000.00'))).toBe(true);
      expect(result.balances.interestBalance.equals(Money.of('100.00'))).toBe(true);
    });

    it('does not reopen a CLOSED loan when the reversed payment left it still fully paid (e.g. an overpayment reversal)', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('1000.00', '100.00');
      // Fully settled by an overpayment (110.00 applied against 100.00 interest due -> extra
      // 10.00 principal), then closed.
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('1010.00'), interestComponent: Money.of('100.00') }));
      loan.close();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      // Reversing only a small 10.00 principal overpayment portion, recorded as its own
      // transaction — the loan remains fully paid afterward.
      const original = buildRepaymentTransaction({ id: 'txn-2', amount: '10.00', principal: '10.00', interest: '0.00' });
      deps.loanTransactionRepository.findById.mockResolvedValue(original);
      deps.loanTransactionRepository.findByReversesTransactionId.mockResolvedValue(null);

      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '100.00' }, { principal: '1010.00', interest: '100.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);

      const allocation = PaymentAllocation.create({
        loanTransactionId: 'txn-2',
        repaymentInstallmentId: 'installment-1',
        principalApplied: Money.of('10.00'),
        interestApplied: Money.ZERO,
        feesApplied: Money.ZERO,
        penaltyApplied: Money.ZERO,
      });
      deps.paymentAllocationRepository.findByLoanTransactionId.mockResolvedValue([allocation]);

      const useCase = new ReversePaymentUseCase(deps);
      const result = await useCase.execute('loan-1', 'txn-2', 'mis-1', 'Correcting an overpayment');

      expect(result.status).toBe('CLOSED');
      expect(result.balances.principalBalance.isZero()).toBe(true);
    });
  });
});
