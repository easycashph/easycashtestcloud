import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RestructureLoanUseCase } from '@modules/loan-account/application/use-cases/RestructureLoanUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { LoanAlreadyRestructuredError, LoanNotEligibleForRestructureError } from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';
import { LoanRestructure } from '@modules/loan-account/domain/LoanRestructure';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { LoanProduct } from '@modules/loan-product/domain/LoanProduct';
import { LoanProductVersion } from '@modules/loan-product/domain/LoanProductVersion';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';
import type { TransactionContext } from '@shared/application/TransactionContext';

const PRINCIPAL = Money.of('50000.00');
const RATE = Percentage.of('3.5');
const OLD_INSTALLMENT_COUNT = 12;
const FIRST_REPAYMENT_DATE = new Date('2026-01-15T00:00:00.000Z');
const NEW_FIRST_REPAYMENT_DATE = new Date('2026-08-01T00:00:00.000Z');

function buildActiveLoan(overrides?: Partial<{ loanCode: string; principalAmount: Money }>) {
  const loan = LoanAccount.create({
    loanCode: overrides?.loanCode ?? 'SML-REG_00001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: overrides?.principalAmount ?? PRINCIPAL,
    interestRate: RATE,
    installmentCount: OLD_INSTALLMENT_COUNT,
    firstRepaymentDate: FIRST_REPAYMENT_DATE,
  });
  loan.approve('officer-1');
  loan.activate({ principalDue: PRINCIPAL, interestDue: Money.of('1750.00'), activatedAt: new Date('2026-01-01T00:00:00.000Z') });
  return loan;
}

/** A single overdue, unpaid installment — the minimum needed to satisfy "past due or matured". */
function buildOverdueInstallment(loanAccountId: string, dueDate: Date) {
  return RepaymentInstallment.create({
    loanAccountId,
    installmentNumber: 1,
    dueDate,
    due: InstallmentAmounts.of({ principal: Money.of('4166.67'), interest: Money.of('145.83') }),
  });
}

function buildLoanProductVersion(interestCalculationMethod: 'DECLINING_BALANCE' | 'FLAT' = 'DECLINING_BALANCE') {
  return LoanProductVersion.create({
    loanProductId: 'product-1',
    versionNumber: 1,
    effectiveFrom: new Date(),
    interestCalculationMethod,
    loanAmountMin: Money.of('1000.00'),
    installmentCountMin: 1,
    gracePeriodDefaultDays: 0,
  });
}

function buildLoanProduct() {
  return LoanProduct.create({ name: 'Salary Loan', code: 'SML-REG' });
}

const mockCtx = { __brand: 'TransactionContext' } as TransactionContext;

function buildDeps() {
  const loanAccountRepository = {
    findById: vi.fn(),
    findByLoanCode: vi.fn(),
    findMany: vi.fn(),
    findBySourceApplicationId: vi.fn(),
    findManyBySourceApplicationIds: vi.fn(),
    findMaxLoanCodeSequenceForPrefix: vi.fn().mockResolvedValue(0),
    save: vi.fn(),
    findMaturedLoanAccountIds: vi.fn(),
  };
  const loanProductRepository = {
    findById: vi.fn(),
    findByCode: vi.fn(),
    findMany: vi.fn(),
    findVersionById: vi.fn(),
    save: vi.fn(),
  };
  const repaymentInstallmentRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
  const loanTransactionRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), create: vi.fn() };
  const loanRestructureRepository = {
    create: vi.fn(),
    findByOldLoanAccountId: vi.fn().mockResolvedValue(null),
    findByNewLoanAccountId: vi.fn(),
    findViewByLoanAccountId: vi.fn(),
  };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn(async (work: (ctx: TransactionContext) => Promise<unknown>) => work(mockCtx)) };

  return {
    loanAccountRepository,
    loanProductRepository,
    repaymentInstallmentRepository,
    loanTransactionRepository,
    loanRestructureRepository,
    financialAuditLogger,
    unitOfWork,
  };
}

function primeHappyPath(deps: ReturnType<typeof buildDeps>, loan: LoanAccount) {
  deps.loanAccountRepository.findById.mockResolvedValue(loan);
  deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([buildOverdueInstallment(loan.id, new Date('2026-02-15T00:00:00.000Z'))]);
  deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());
  deps.loanProductRepository.findById.mockResolvedValue(buildLoanProduct());
}

describe('RestructureLoanUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new ACTIVE loan account whose principal equals the old loan\'s Collections Balance', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new RestructureLoanUseCase(deps);
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      installmentCount: 6,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      restructuredByUserId: 'staff-1',
    });

    expect(newLoanAccount.status).toBe('ACTIVE');
    expect(newLoanAccount.principalAmount.equals(loan.collectionsBalance)).toBe(true);
    expect(newLoanAccount.installmentCount).toBe(6);
    expect(newLoanAccount.firstRepaymentDate).toEqual(NEW_FIRST_REPAYMENT_DATE);
  });

  it('copies the product/interest rate from the old loan rather than accepting them as input', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new RestructureLoanUseCase(deps);
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      installmentCount: 6,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      restructuredByUserId: 'staff-1',
    });

    expect(newLoanAccount.loanProductVersionId).toBe(loan.loanProductVersionId);
    expect(newLoanAccount.interestRate.equals(loan.interestRate)).toBe(true);
  });

  it('closes the old loan as CLOSED_RESTRUCTURED without touching its balance columns', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    const previousBalance = loan.collectionsBalance;
    primeHappyPath(deps, loan);

    const useCase = new RestructureLoanUseCase(deps);
    const { oldLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      installmentCount: 6,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      restructuredByUserId: 'staff-1',
    });

    expect(oldLoanAccount.status).toBe('CLOSED_RESTRUCTURED');
    expect(oldLoanAccount.closedReason).toBe('Restructured');
    expect(oldLoanAccount.collectionsBalance.equals(previousBalance)).toBe(true);
  });

  it('creates a LoanRestructure audit row linking both accounts', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new RestructureLoanUseCase(deps);
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      installmentCount: 6,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      reason: 'Client requested lower monthly',
      restructuredByUserId: 'staff-1',
    });

    expect(deps.loanRestructureRepository.create).toHaveBeenCalledTimes(1);
    const restructure = deps.loanRestructureRepository.create.mock.calls[0]?.[0] as LoanRestructure;
    expect(restructure.oldLoanAccountId).toBe(loan.id);
    expect(restructure.newLoanAccountId).toBe(newLoanAccount.id);
    expect(restructure.newPrincipalAmount.equals(loan.collectionsBalance)).toBe(true);
    expect(restructure.reason).toBe('Client requested lower monthly');
  });

  it('tags the new loan\'s DISBURSEMENT transaction with paymentMethod RESTRUCTURE', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new RestructureLoanUseCase(deps);
    await useCase.execute({
      oldLoanAccountId: loan.id,
      installmentCount: 6,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      restructuredByUserId: 'staff-1',
    });

    expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
    const transaction = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
    expect(transaction.type).toBe('DISBURSEMENT');
    expect(transaction.paymentMethod).toBe('RESTRUCTURE');
  });

  it('rejects a loan that is not ACTIVE/ACTIVE_IN_ARREARS', async () => {
    const deps = buildDeps();
    const loan = LoanAccount.create({
      loanCode: 'SML-REG_00002',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      installmentCount: OLD_INSTALLMENT_COUNT,
      firstRepaymentDate: FIRST_REPAYMENT_DATE,
    });
    deps.loanAccountRepository.findById.mockResolvedValue(loan);

    const useCase = new RestructureLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: loan.id, installmentCount: 6, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, restructuredByUserId: 'staff-1' }),
    ).rejects.toThrow(LoanNotEligibleForRestructureError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects a current (not past due/matured) loan — "Ino offer lang ito sa mga past due at matured account"', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    // Every installment due in the future, none overdue.
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([buildOverdueInstallment(loan.id, new Date('2099-01-01T00:00:00.000Z'))]);

    const useCase = new RestructureLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: loan.id, installmentCount: 6, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, restructuredByUserId: 'staff-1' }),
    ).rejects.toThrow(LoanNotEligibleForRestructureError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects a loan already restructured once — "isang beses lang pwede gawin per loan account"', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.loanRestructureRepository.findByOldLoanAccountId.mockResolvedValue(
      LoanRestructure.create({
        oldLoanAccountId: loan.id,
        newLoanAccountId: 'new-loan-1',
        previousCollectionsBalance: PRINCIPAL,
        newPrincipalAmount: PRINCIPAL,
        restructuredByUserId: 'staff-0',
      }),
    );

    const useCase = new RestructureLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: loan.id, installmentCount: 6, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, restructuredByUserId: 'staff-1' }),
    ).rejects.toThrow(LoanAlreadyRestructuredError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(null);

    const useCase = new RestructureLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: 'missing', installmentCount: 6, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, restructuredByUserId: 'staff-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('performs every write inside one IUnitOfWork.run() call, sharing the same ctx', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new RestructureLoanUseCase(deps);
    await useCase.execute({ oldLoanAccountId: loan.id, installmentCount: 6, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, restructuredByUserId: 'staff-1' });

    expect(deps.unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, mockCtx);
    expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith(expect.any(Array), mockCtx);
    expect(deps.loanTransactionRepository.create).toHaveBeenCalledWith(expect.anything(), mockCtx);
    expect(deps.loanRestructureRepository.create).toHaveBeenCalledWith(expect.anything(), mockCtx);
    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(expect.anything(), mockCtx);
  });
});
