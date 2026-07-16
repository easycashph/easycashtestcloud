import { describe, expect, it, vi } from 'vitest';
import { UndoActivateLoanUseCase } from '@modules/loan-account/application/use-cases/UndoActivateLoanUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';
import {
  InvalidStatusTransitionError,
  LoanAccountHasActivityError,
} from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';

function buildActiveLoan() {
  const loan = LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 12,
    firstRepaymentDate: new Date('2026-08-15'),
  });
  loan.approve('officer-1');
  loan.activate({ principalDue: Money.of('10000.00'), interestDue: Money.of('500.00') });
  return loan;
}

function disbursementTransaction(loanAccountId: string) {
  return LoanTransaction.reconstitute({
    id: 'txn-disbursement',
    loanAccountId,
    type: 'DISBURSEMENT',
    amount: Money.of('10000.00'),
    components: TransactionComponents.of({ principalComponent: Money.of('10000.00') }),
    balanceAfter: Money.of('10000.00'),
    branchId: 'branch-1',
    entryDate: new Date(),
    createdAt: new Date(),
  });
}

function buildDeps(loan: LoanAccount | null, overrides: Partial<{ transactions: LoanTransaction[]; penaltyReductions: unknown[]; feeAdjustments: unknown[] }> = {}) {
  const loanAccountRepository = { findById: vi.fn().mockResolvedValue(loan), findByLoanCode: vi.fn(), save: vi.fn() };
  const repaymentInstallmentRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn(), deleteAllByLoanAccountId: vi.fn() };
  const loanTransactionRepository = {
    findById: vi.fn(),
    findByLoanAccountId: vi.fn().mockResolvedValue(overrides.transactions ?? (loan ? [disbursementTransaction(loan.id)] : [])),
    findByReversesTransactionId: vi.fn(),
    create: vi.fn(),
  };
  const penaltyReductionRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue(overrides.penaltyReductions ?? []) };
  const feeAdjustmentRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue(overrides.feeAdjustments ?? []) };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn((work: (ctx: undefined) => Promise<unknown>) => work(undefined)) };
  return {
    loanAccountRepository,
    repaymentInstallmentRepository,
    loanTransactionRepository,
    penaltyReductionRepository,
    feeAdjustmentRepository,
    financialAuditLogger,
    unitOfWork,
  };
}

describe('UndoActivateLoanUseCase (2026-07-16, MIS-only safety net for an accidental Activate click)', () => {
  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps(null);
    const useCase = new UndoActivateLoanUseCase(deps);

    await expect(useCase.execute('missing-loan', 'mis-1')).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('undoes the activation, deletes the installment schedule, and saves the loan account when nothing else happened yet', async () => {
    const loan = buildActiveLoan();
    const deps = buildDeps(loan);
    const useCase = new UndoActivateLoanUseCase(deps);

    await useCase.execute(loan.id, 'mis-1');

    expect(loan.status).toBe('APPROVED');
    expect(loan.balances.principalBalance.isZero()).toBe(true);
    expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, undefined);
    expect(deps.repaymentInstallmentRepository.deleteAllByLoanAccountId).toHaveBeenCalledWith(loan.id, undefined);
  });

  it('does NOT delete the DISBURSEMENT transaction — TXN-1 stays append-only', async () => {
    const loan = buildActiveLoan();
    const deps = buildDeps(loan);
    const useCase = new UndoActivateLoanUseCase(deps);

    await useCase.execute(loan.id, 'mis-1');

    expect(deps.loanTransactionRepository.findByLoanAccountId).toHaveBeenCalled();
    // No delete method exists on the mocked repository at all — this call would throw if the use
    // case tried to invoke one, proving none is called.
  });

  it('writes a financial audit log entry', async () => {
    const loan = buildActiveLoan();
    const deps = buildDeps(loan);
    const useCase = new UndoActivateLoanUseCase(deps);

    await useCase.execute(loan.id, 'mis-1');

    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'mis-1',
        action: 'UNDO_ACTIVATE_LOAN',
        entityType: 'LoanAccount',
        entityId: loan.id,
        previousValue: { status: 'ACTIVE' },
        newValue: { status: 'APPROVED' },
      }),
      undefined,
    );
  });

  it('refuses when a REPAYMENT transaction has already been recorded', async () => {
    const loan = buildActiveLoan();
    const repayment = LoanTransaction.reconstitute({
      id: 'txn-repayment',
      loanAccountId: loan.id,
      type: 'REPAYMENT',
      amount: Money.of('500.00'),
      components: TransactionComponents.of({ principalComponent: Money.of('500.00') }),
      balanceAfter: Money.of('9500.00'),
      branchId: 'branch-1',
      entryDate: new Date(),
      createdAt: new Date(),
    });
    const deps = buildDeps(loan, { transactions: [disbursementTransaction(loan.id), repayment] });
    const useCase = new UndoActivateLoanUseCase(deps);

    await expect(useCase.execute(loan.id, 'mis-1')).rejects.toThrow(LoanAccountHasActivityError);
    expect(deps.loanAccountRepository.save).not.toHaveBeenCalled();
    expect(deps.repaymentInstallmentRepository.deleteAllByLoanAccountId).not.toHaveBeenCalled();
  });

  it('refuses when a penalty reduction already exists on one of its installments', async () => {
    const loan = buildActiveLoan();
    const deps = buildDeps(loan, { penaltyReductions: [{ id: 'pr-1' }] });
    const useCase = new UndoActivateLoanUseCase(deps);

    await expect(useCase.execute(loan.id, 'mis-1')).rejects.toThrow(LoanAccountHasActivityError);
    expect(deps.loanAccountRepository.save).not.toHaveBeenCalled();
  });

  it('refuses when a fee adjustment already exists on one of its installments', async () => {
    const loan = buildActiveLoan();
    const deps = buildDeps(loan, { feeAdjustments: [{ id: 'fa-1' }] });
    const useCase = new UndoActivateLoanUseCase(deps);

    await expect(useCase.execute(loan.id, 'mis-1')).rejects.toThrow(LoanAccountHasActivityError);
    expect(deps.loanAccountRepository.save).not.toHaveBeenCalled();
  });

  it('propagates InvalidStatusTransitionError when the loan is not ACTIVE', async () => {
    const loan = LoanAccount.create({
      loanCode: 'LN-0001',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: Money.of('10000.00'),
      interestRate: Percentage.of('2.5'),
      installmentCount: 12,
      firstRepaymentDate: new Date('2026-08-15'),
    });
    loan.approve('officer-1');
    const deps = buildDeps(loan, { transactions: [] });
    const useCase = new UndoActivateLoanUseCase(deps);

    await expect(useCase.execute(loan.id, 'mis-1')).rejects.toThrow(InvalidStatusTransitionError);
  });
});
