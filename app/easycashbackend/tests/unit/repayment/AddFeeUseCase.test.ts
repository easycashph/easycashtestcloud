import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddFeeUseCase } from '@modules/repayment/application/use-cases/AddFeeUseCase';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { InvalidFeeChargeAmountError } from '@modules/repayment/domain/errors/RepaymentDomainErrors';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';
import type { TransactionContext } from '@shared/application/TransactionContext';

function buildActiveLoan() {
  const loan = LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('3000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 3,
    firstRepaymentDate: new Date('2026-08-15'),
  });
  loan.approve('officer-1');
  loan.activate({ principalDue: Money.of('3000.00'), interestDue: Money.of('450.00') });
  return loan;
}

function buildInstallment(feesDue = '0.00', feesPaid = '0.00') {
  return RepaymentInstallment.reconstitute({
    id: 'installment-1',
    loanAccountId: 'loan-1',
    installmentNumber: 1,
    dueDate: new Date('2026-08-15'),
    due: InstallmentAmounts.of({ principal: Money.of('1000.00'), interest: Money.of('150.00'), fees: Money.of(feesDue) }),
    paid: InstallmentAmounts.of({ fees: Money.of(feesPaid) }),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  });
}

const mockCtx = { __brand: 'TransactionContext' } as TransactionContext;

function buildDeps() {
  const repaymentInstallmentRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
  const loanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn(), save: vi.fn() };
  const loanTransactionRepository = {
    findById: vi.fn(),
    findByLoanAccountId: vi.fn(),
    findByReversesTransactionId: vi.fn(),
    findPossibleMigratedDuplicate: vi.fn(),
    create: vi.fn(),
  };
  const feeChargeRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn() };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn(async (work: (ctx: TransactionContext) => Promise<unknown>) => work(mockCtx)) };

  return { repaymentInstallmentRepository, loanAccountRepository, loanTransactionRepository, feeChargeRepository, financialAuditLogger, unitOfWork };
}

describe('AddFeeUseCase', () => {
  let deps: ReturnType<typeof buildDeps>;

  beforeEach(() => {
    deps = buildDeps();
  });

  it('throws NotFoundError when the installment does not exist', async () => {
    deps.repaymentInstallmentRepository.findById.mockResolvedValue(null);
    const useCase = new AddFeeUseCase(deps);

    await expect(useCase.execute('missing', Money.of('50.00'), 'reason', 'user-1')).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the parent loan account does not exist', async () => {
    deps.repaymentInstallmentRepository.findById.mockResolvedValue(buildInstallment());
    deps.loanAccountRepository.findById.mockResolvedValue(null);
    const useCase = new AddFeeUseCase(deps);

    await expect(useCase.execute('installment-1', Money.of('50.00'), 'reason', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('rejects a zero or negative amount via the entity, before any write', async () => {
    deps.repaymentInstallmentRepository.findById.mockResolvedValue(buildInstallment());
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan());
    const useCase = new AddFeeUseCase(deps);

    await expect(useCase.execute('installment-1', Money.ZERO, 'reason', 'user-1')).rejects.toThrow(InvalidFeeChargeAmountError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('adds to feesDue, syncs the loan balance, creates a FEE_CHARGED transaction and a FeeCharge audit row', async () => {
    const installment = buildInstallment('0.00');
    const loanAccount = buildActiveLoan();
    deps.repaymentInstallmentRepository.findById.mockResolvedValue(installment);
    deps.loanAccountRepository.findById.mockResolvedValue(loanAccount);
    const useCase = new AddFeeUseCase(deps);

    const feesBalanceBefore = loanAccount.balances.feesBalance;

    await useCase.execute('installment-1', Money.of('500.00'), 'Late payment fee, memo #2026-0815', 'user-1');

    expect(installment.effectiveFeesDue.equals(Money.of('500.00'))).toBe(true);
    expect(loanAccount.balances.feesBalance.equals(feesBalanceBefore.add(Money.of('500.00')))).toBe(true);

    expect(deps.repaymentInstallmentRepository.save).toHaveBeenCalledWith(installment, mockCtx);
    expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loanAccount, mockCtx);

    expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
    const transaction = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
    expect(transaction.type).toBe('FEE_CHARGED');
    expect(transaction.amount.equals(Money.of('500.00'))).toBe(true);
    expect(transaction.components.feesComponent.equals(Money.of('500.00'))).toBe(true);
    expect(transaction.components.principalComponent.isZero()).toBe(true);

    expect(deps.feeChargeRepository.create).toHaveBeenCalledTimes(1);
    const charge = deps.feeChargeRepository.create.mock.calls[0]?.[0];
    expect(charge.previousFeesAmount.isZero()).toBe(true);
    expect(charge.newFeesAmount.equals(Money.of('500.00'))).toBe(true);
    expect(charge.reason).toBe('Late payment fee, memo #2026-0815');
    expect(charge.loanTransactionId).toBe(transaction.id);

    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', action: 'CHARGE_FEE', entityType: 'RepaymentInstallment', entityId: 'installment-1' }),
      mockCtx,
    );
  });

  it('is not blocked by an already-paid fees component, unlike Adjust Fees', async () => {
    const installment = buildInstallment('100.00', '100.00'); // fully paid off already
    deps.repaymentInstallmentRepository.findById.mockResolvedValue(installment);
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan());
    const useCase = new AddFeeUseCase(deps);

    await expect(useCase.execute('installment-1', Money.of('75.00'), 'a brand new late fee', 'user-1')).resolves.toBeUndefined();
    expect(installment.effectiveFeesDue.equals(Money.of('175.00'))).toBe(true);
  });

  it('stacks on top of an existing feesOverride rather than replacing it', async () => {
    const installment = buildInstallment('200.00');
    installment.adjustFees(Money.of('300.00'), 'earlier correction', 'user-2');
    deps.repaymentInstallmentRepository.findById.mockResolvedValue(installment);
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan());
    const useCase = new AddFeeUseCase(deps);

    await useCase.execute('installment-1', Money.of('50.00'), 'new late fee', 'user-1');

    expect(installment.effectiveFeesDue.equals(Money.of('350.00'))).toBe(true);
  });
});
