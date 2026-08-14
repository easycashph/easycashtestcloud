import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualPaymentAdjustmentUseCase } from '@modules/loan-account/application/use-cases/ManualPaymentAdjustmentUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { PaymentAllocation } from '@modules/ledger/domain/PaymentAllocation';
import { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
import {
  EmptyPaymentAdjustmentError,
  PaymentAdjustmentExceedsPaidAmountError,
  TransactionHasAllocationDataError,
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

/** A migrated payment: aggregate components populated, but no PaymentAllocation rows (the whole point of this feature). */
function buildLegacyRepaymentTransaction(
  overrides: Partial<{ id: string; amount: string; principal: string; interest: string }> = {},
) {
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
    legacyId: 'legacy-txn-9',
    createdAt: new Date('2026-08-20'),
  });
}

function line(
  installmentId: string,
  amounts: Partial<{ principal: string; interest: string; fees: string; penalty: string }>,
) {
  return {
    installmentId,
    principalReduction: Money.of(amounts.principal ?? '0'),
    interestReduction: Money.of(amounts.interest ?? '0'),
    feesReduction: Money.of(amounts.fees ?? '0'),
    penaltyReduction: Money.of(amounts.penalty ?? '0'),
  };
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
  const paymentAllocationRepository = { createMany: vi.fn(), findByLoanTransactionId: vi.fn().mockResolvedValue([]) };
  const paymentAdjustmentRepository = { createMany: vi.fn(), findByLoanTransactionId: vi.fn() };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn(async (work: (ctx: TransactionContext) => Promise<unknown>) => work(mockCtx)) };

  return {
    loanAccountRepository,
    repaymentInstallmentRepository,
    loanTransactionRepository,
    paymentAllocationRepository,
    paymentAdjustmentRepository,
    financialAuditLogger,
    unitOfWork,
  };
}

describe('ManualPaymentAdjustmentUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(null);
    const useCase = new ManualPaymentAdjustmentUseCase(deps);

    await expect(
      useCase.execute('missing-loan', 'txn-1', [line('installment-1', { principal: '100.00' })], 'correction', 'mis-1'),
    ).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
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
    const useCase = new ManualPaymentAdjustmentUseCase(deps);

    await expect(
      useCase.execute('loan-1', 'txn-1', [line('installment-1', { principal: '100.00' })], 'correction', 'mis-1'),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects adjusting a non-REPAYMENT transaction', async () => {
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
    const useCase = new ManualPaymentAdjustmentUseCase(deps);

    await expect(
      useCase.execute('loan-1', 'txn-1', [line('installment-1', { principal: '100.00' })], 'correction', 'mis-1'),
    ).rejects.toThrow(TransactionNotReversibleError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  // The mirror image of ReversePaymentUseCase's NoReversibleAllocationDataError guard: this tool is
  // only for transactions that flow can't handle, so a transaction it CAN handle is refused here.
  it('rejects a transaction that DOES have a PaymentAllocation breakdown — Reverse Payment handles those precisely', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    deps.loanTransactionRepository.findById.mockResolvedValue(buildLegacyRepaymentTransaction());
    deps.paymentAllocationRepository.findByLoanTransactionId.mockResolvedValue([
      PaymentAllocation.create({
        loanTransactionId: 'txn-1',
        repaymentInstallmentId: 'installment-1',
        principalApplied: Money.of('1000.00'),
        interestApplied: Money.of('200.00'),
        feesApplied: Money.ZERO,
        penaltyApplied: Money.ZERO,
      }),
    ]);
    const useCase = new ManualPaymentAdjustmentUseCase(deps);

    await expect(
      useCase.execute('loan-1', 'txn-1', [line('installment-1', { principal: '100.00' })], 'correction', 'mis-1'),
    ).rejects.toThrow(TransactionHasAllocationDataError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects an adjustment where every line is zero', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    deps.loanTransactionRepository.findById.mockResolvedValue(buildLegacyRepaymentTransaction());
    const useCase = new ManualPaymentAdjustmentUseCase(deps);

    await expect(useCase.execute('loan-1', 'txn-1', [line('installment-1', {})], 'correction', 'mis-1')).rejects.toThrow(
      EmptyPaymentAdjustmentError,
    );
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  // The guard ReversePaymentUseCase doesn't need (it only replays exact prior amounts) but a
  // human-typed reduction does — recordPayment() itself has no non-negative floor.
  it('rejects reducing a component by more than what is currently recorded as paid', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    deps.loanTransactionRepository.findById.mockResolvedValue(buildLegacyRepaymentTransaction());
    const inst1 = buildInstallment(1, { principal: '1000.00', interest: '200.00' }, { principal: '500.00', interest: '200.00' });
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);
    const useCase = new ManualPaymentAdjustmentUseCase(deps);

    await expect(
      useCase.execute('loan-1', 'txn-1', [line('installment-1', { principal: '700.00' })], 'correction', 'mis-1'),
    ).rejects.toThrow(PaymentAdjustmentExceedsPaidAmountError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
    // Nothing was mutated before the guard fired.
    expect(inst1.paid.principal.equals(Money.of('500.00'))).toBe(true);
  });

  it('throws NotFoundError when a line references an installment on another loan account', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('2000.00', '300.00'));
    deps.loanTransactionRepository.findById.mockResolvedValue(buildLegacyRepaymentTransaction());
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([]);
    const useCase = new ManualPaymentAdjustmentUseCase(deps);

    await expect(
      useCase.execute('loan-1', 'txn-1', [line('installment-999', { principal: '100.00' })], 'correction', 'mis-1'),
    ).rejects.toThrow(NotFoundError);
  });

  describe('happy path', () => {
    it('reduces a single installment, syncs loan balances, and records an ADJUSTMENT transaction plus a PaymentAdjustment row', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('2000.00', '300.00');
      loan.applyPayment(
        TransactionComponents.of({ principalComponent: Money.of('1000.00'), interestComponent: Money.of('200.00') }),
        new Date('2026-08-20'),
      );
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanTransactionRepository.findById.mockResolvedValue(buildLegacyRepaymentTransaction());

      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '200.00' }, { principal: '1000.00', interest: '200.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);

      const useCase = new ManualPaymentAdjustmentUseCase(deps);
      const result = await useCase.execute(
        'loan-1',
        'txn-1',
        [line('installment-1', { principal: '1000.00', interest: '200.00' })],
        'Duplicate encoding, verified against OR #12345',
        'mis-1',
      );

      expect(inst1.paid.principal.isZero()).toBe(true);
      expect(inst1.paid.interest.isZero()).toBe(true);

      expect(result.balances.principalPaid.isZero()).toBe(true);
      expect(result.balances.interestPaid.isZero()).toBe(true);
      expect(result.balances.principalBalance.equals(Money.of('2000.00'))).toBe(true);

      // ADJUSTMENT, not REVERSAL — reversesTransactionId stays reserved for the precise flow.
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
      const adjustmentTxn = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
      expect(adjustmentTxn.type).toBe('ADJUSTMENT');
      expect(adjustmentTxn.reversesTransactionId).toBeUndefined();
      expect(adjustmentTxn.amount.equals(Money.of('-1200.00'))).toBe(true);
      expect(adjustmentTxn.components.principalComponent.equals(Money.of('-1000.00'))).toBe(true);
      expect(adjustmentTxn.components.interestComponent.equals(Money.of('-200.00'))).toBe(true);
      expect(adjustmentTxn.postedByUserId).toBe('mis-1');
      expect(adjustmentTxn.comment).toContain('Duplicate encoding, verified against OR #12345');
      expect(adjustmentTxn.comment).toContain('txn-1');

      // The immutable audit row, capturing before/after per component.
      expect(deps.paymentAdjustmentRepository.createMany).toHaveBeenCalledTimes(1);
      const [records] = deps.paymentAdjustmentRepository.createMany.mock.calls[0] ?? [];
      expect(records).toHaveLength(1);
      expect(records[0].loanTransactionId).toBe('txn-1');
      expect(records[0].repaymentInstallmentId).toBe('installment-1');
      expect(records[0].previousPrincipalPaid.equals(Money.of('1000.00'))).toBe(true);
      expect(records[0].newPrincipalPaid.isZero()).toBe(true);
      expect(records[0].previousInterestPaid.equals(Money.of('200.00'))).toBe(true);
      expect(records[0].newInterestPaid.isZero()).toBe(true);
      expect(records[0].reason).toBe('Duplicate encoding, verified against OR #12345');
      expect(records[0].adjustedByUserId).toBe('mis-1');

      // Atomicity + audit trail, same shape as ReversePaymentUseCase.
      expect(deps.unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, mockCtx);
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith([inst1], mockCtx);
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledWith(adjustmentTxn, mockCtx);
      expect(deps.paymentAdjustmentRepository.createMany).toHaveBeenCalledWith(records, mockCtx);

      const [entry] = deps.financialAuditLogger.log.mock.calls[0] ?? [];
      expect(entry.action).toBe('MANUAL_PAYMENT_ADJUSTMENT');
      expect(entry.entityType).toBe('LoanAccount');
      expect(entry.entityId).toBe(loan.id);
      expect(entry.userId).toBe('mis-1');
    });

    it('splits a correction across several installments, one PaymentAdjustment row each', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('3000.00', '450.00');
      loan.applyPayment(
        TransactionComponents.of({ principalComponent: Money.of('1200.00'), interestComponent: Money.of('100.00') }),
        new Date('2026-08-20'),
      );
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanTransactionRepository.findById.mockResolvedValue(
        buildLegacyRepaymentTransaction({ amount: '1300.00', principal: '1200.00', interest: '100.00' }),
      );

      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '200.00' }, { principal: '1000.00', interest: '100.00' });
      const inst2 = buildInstallment(2, { principal: '1000.00', interest: '150.00' }, { principal: '200.00', interest: '0.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1, inst2]);

      const useCase = new ManualPaymentAdjustmentUseCase(deps);
      const result = await useCase.execute(
        'loan-1',
        'txn-1',
        [line('installment-1', { principal: '1000.00', interest: '100.00' }), line('installment-2', { principal: '200.00' })],
        'Duplicate encoding',
        'mis-1',
      );

      expect(inst1.paid.principal.isZero()).toBe(true);
      expect(inst1.paid.interest.isZero()).toBe(true);
      expect(inst2.paid.principal.isZero()).toBe(true);

      expect(result.balances.principalPaid.isZero()).toBe(true);
      expect(result.balances.interestPaid.isZero()).toBe(true);

      const [records] = deps.paymentAdjustmentRepository.createMany.mock.calls[0] ?? [];
      expect(records).toHaveLength(2);
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith(expect.arrayContaining([inst1, inst2]), mockCtx);

      const adjustmentTxn = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
      expect(adjustmentTxn.amount.equals(Money.of('-1300.00'))).toBe(true);
    });

    // Same real-world failure ReversePaymentUseCase guards against (SML-REG_00378): undoing the
    // settling payment must not leave the loan stuck CLOSED with a nonzero balance.
    it('reopens a CLOSED loan when the adjustment leaves a real outstanding balance', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('1000.00', '100.00');
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('1000.00'), interestComponent: Money.of('100.00') }));
      loan.close();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanTransactionRepository.findById.mockResolvedValue(
        buildLegacyRepaymentTransaction({ amount: '1100.00', principal: '1000.00', interest: '100.00' }),
      );

      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);

      const useCase = new ManualPaymentAdjustmentUseCase(deps);
      const result = await useCase.execute(
        'loan-1',
        'txn-1',
        [line('installment-1', { principal: '1000.00', interest: '100.00' })],
        'Payment was never actually received',
        'mis-1',
      );

      expect(result.status).toBe('ACTIVE');
      expect(result.closedAt).toBeUndefined();
      expect(result.balances.principalBalance.equals(Money.of('1000.00'))).toBe(true);
    });

    it('ignores all-zero lines mixed in with real ones rather than writing empty adjustment rows', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('3000.00', '450.00');
      loan.applyPayment(TransactionComponents.of({ principalComponent: Money.of('500.00') }), new Date('2026-08-20'));
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanTransactionRepository.findById.mockResolvedValue(
        buildLegacyRepaymentTransaction({ amount: '500.00', principal: '500.00', interest: '0.00' }),
      );

      const inst1 = buildInstallment(1, { principal: '1000.00', interest: '200.00' }, { principal: '500.00', interest: '0.00' });
      const inst2 = buildInstallment(2, { principal: '1000.00', interest: '150.00' }, { principal: '0.00', interest: '0.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1, inst2]);

      const useCase = new ManualPaymentAdjustmentUseCase(deps);
      await useCase.execute(
        'loan-1',
        'txn-1',
        [line('installment-1', { principal: '500.00' }), line('installment-2', {})],
        'Duplicate encoding',
        'mis-1',
      );

      const [records] = deps.paymentAdjustmentRepository.createMany.mock.calls[0] ?? [];
      expect(records).toHaveLength(1);
      expect(records[0].repaymentInstallmentId).toBe('installment-1');
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith([inst1], mockCtx);
    });
  });
});
