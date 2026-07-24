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

  it('creates a new ACTIVE loan account whose principal is unpaid principal + unpaid interest (no penalty/accrued interest here)', async () => {
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
    // 2026-07-24 follow-up: unpaid principal (4166.67) + unpaid interest (145.83) - penalty and
    // accrued interest are both deterministically ₱0 here (no contractualInterestRate set on the
    // fixture loan, and the single-installment fixture's own dueDate IS the maturity date, so
    // there's no elapsed time for penalty to accrue past it either).
    expect(newLoanAccount.principalAmount.equals(Money.of('4312.50'))).toBe(true);
    expect(newLoanAccount.installmentCount).toBe(6);
    expect(newLoanAccount.firstRepaymentDate).toEqual(NEW_FIRST_REPAYMENT_DATE);
  });

  it('includes unpaid principal/interest from NOT-yet-due installments too - "kahit hindi pa due ang installment"', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    // Installment #1 is overdue (satisfies eligibility); #2 is not yet due (far in the future) -
    // both must still count toward the new principal.
    const overdue = buildOverdueInstallment(loan.id, new Date('2026-02-15T00:00:00.000Z'));
    const notYetDue = RepaymentInstallment.create({
      loanAccountId: loan.id,
      installmentNumber: 2,
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
      due: InstallmentAmounts.of({ principal: Money.of('1000.00'), interest: Money.of('50.00') }),
    });
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([overdue, notYetDue]);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());
    deps.loanProductRepository.findById.mockResolvedValue(buildLoanProduct());

    const useCase = new RestructureLoanUseCase(deps);
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      installmentCount: 6,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      restructuredByUserId: 'staff-1',
    });

    // 4166.67 + 145.83 (installment #1) + 1000.00 + 50.00 (installment #2, not yet due) = 5362.50
    // is the floor - #1's penalty is no longer capped at its OWN due date now that #2 (far in the
    // future) pushes the schedule's maturityDate out, so it may add a live ADR-050 amount on top
    // (wall-clock-dependent, not asserted exactly here). The key behavior under test - that #2's
    // principal/interest are NOT excluded just because it isn't due yet - only needs >=.
    expect(Number(newLoanAccount.principalAmount.toString())).toBeGreaterThanOrEqual(5362.5);
  });

  it('adds Accrued Interest when the loan has genuinely matured with a contractual rate set', async () => {
    const deps = buildDeps();
    const loan = LoanAccount.create({
      loanCode: 'SML-REG_00099',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      contractualInterestRate: Percentage.of('4.95'),
      installmentCount: OLD_INSTALLMENT_COUNT,
      firstRepaymentDate: FIRST_REPAYMENT_DATE,
    });
    loan.approve('officer-1');
    loan.activate({ principalDue: PRINCIPAL, interestDue: Money.of('1750.00'), activatedAt: new Date('2026-01-01T00:00:00.000Z') });
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    // Due far enough in the past that maturity has definitely elapsed, regardless of wall-clock
    // drift between when this test was written and when it runs.
    const matured = buildOverdueInstallment(loan.id, new Date('2020-01-01T00:00:00.000Z'));
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([matured]);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());
    deps.loanProductRepository.findById.mockResolvedValue(buildLoanProduct());

    const useCase = new RestructureLoanUseCase(deps);
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      installmentCount: 6,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      restructuredByUserId: 'staff-1',
    });

    // Unpaid principal + interest (4312.50) alone would be the floor - Accrued Interest and/or
    // frozen Penalty on top must push the actual figure strictly higher, since this installment
    // has been overdue for years with a real contractual rate set.
    expect(Number(newLoanAccount.principalAmount.toString())).toBeGreaterThan(4312.5);
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
    expect(restructure.newPrincipalAmount.equals(Money.of('4312.50'))).toBe(true);
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
