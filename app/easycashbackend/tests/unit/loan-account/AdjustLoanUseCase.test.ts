import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdjustLoanUseCase } from '@modules/loan-account/application/use-cases/AdjustLoanUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { LoanAlreadyAdjustedError, LoanNotEligibleForAdjustmentError } from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';
import { LoanAdjustment } from '@modules/loan-account/domain/LoanAdjustment';
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
const INSTALLMENT_COUNT = 12;
// Far enough in the future that "before the first due date" always holds, regardless of wall-clock
// drift between when this test was written and when it runs.
const FIRST_REPAYMENT_DATE = new Date('2099-01-15T00:00:00.000Z');
const NEW_FIRST_REPAYMENT_DATE = new Date('2099-02-01T00:00:00.000Z');

function buildActiveLoan(overrides?: Partial<{ loanCode: string; firstRepaymentDate: Date }>) {
  const loan = LoanAccount.create({
    loanCode: overrides?.loanCode ?? 'SML-REG_00001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: PRINCIPAL,
    interestRate: RATE,
    installmentCount: INSTALLMENT_COUNT,
    firstRepaymentDate: overrides?.firstRepaymentDate ?? FIRST_REPAYMENT_DATE,
  });
  loan.approve('officer-1');
  loan.activate({ principalDue: PRINCIPAL, interestDue: Money.of('1750.00'), activatedAt: new Date() });
  return loan;
}

function buildUnpaidInstallment(loanAccountId: string, installmentNumber: number, dueDate: Date) {
  return RepaymentInstallment.create({
    loanAccountId,
    installmentNumber,
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
  const loanAdjustmentRepository = {
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
    loanAdjustmentRepository,
    financialAuditLogger,
    unitOfWork,
  };
}

function primeHappyPath(deps: ReturnType<typeof buildDeps>, loan: LoanAccount) {
  deps.loanAccountRepository.findById.mockResolvedValue(loan);
  deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([buildUnpaidInstallment(loan.id, 1, FIRST_REPAYMENT_DATE)]);
  deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());
  deps.loanProductRepository.findById.mockResolvedValue(buildLoanProduct());
}

describe('AdjustLoanUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new ACTIVE loan account with the same principal/rate/term copied verbatim', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new AdjustLoanUseCase(deps);
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      adjustedByUserId: 'staff-1',
    });

    expect(newLoanAccount.status).toBe('ACTIVE');
    expect(newLoanAccount.principalAmount.equals(loan.principalAmount)).toBe(true);
    expect(newLoanAccount.interestRate.equals(loan.interestRate)).toBe(true);
    expect(newLoanAccount.installmentCount).toBe(loan.installmentCount);
    expect(newLoanAccount.loanProductVersionId).toBe(loan.loanProductVersionId);
    expect(newLoanAccount.firstRepaymentDate).toEqual(NEW_FIRST_REPAYMENT_DATE);
  });

  it('closes the old loan as CLOSED_ADJUSTED without touching its balance columns', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    const previousBalance = loan.collectionsBalance;
    primeHappyPath(deps, loan);

    const useCase = new AdjustLoanUseCase(deps);
    const { oldLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      adjustedByUserId: 'staff-1',
    });

    expect(oldLoanAccount.status).toBe('CLOSED_ADJUSTED');
    expect(oldLoanAccount.closedReason).toBe('Adjusted');
    expect(oldLoanAccount.collectionsBalance.equals(previousBalance)).toBe(true);
  });

  it('creates a LoanAdjustment audit row linking both accounts', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new AdjustLoanUseCase(deps);
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      reason: 'Wrong due date encoded',
      adjustedByUserId: 'staff-1',
    });

    expect(deps.loanAdjustmentRepository.create).toHaveBeenCalledTimes(1);
    const adjustment = deps.loanAdjustmentRepository.create.mock.calls[0]?.[0] as LoanAdjustment;
    expect(adjustment.oldLoanAccountId).toBe(loan.id);
    expect(adjustment.newLoanAccountId).toBe(newLoanAccount.id);
    expect(adjustment.previousFirstRepaymentDate).toEqual(FIRST_REPAYMENT_DATE);
    expect(adjustment.newFirstRepaymentDate).toEqual(NEW_FIRST_REPAYMENT_DATE);
    expect(adjustment.reason).toBe('Wrong due date encoded');
  });

  it("tags the new loan's DISBURSEMENT transaction with paymentMethod ADJUSTMENT", async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new AdjustLoanUseCase(deps);
    await useCase.execute({ oldLoanAccountId: loan.id, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, adjustedByUserId: 'staff-1' });

    expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
    const transaction = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
    expect(transaction.type).toBe('DISBURSEMENT');
    expect(transaction.paymentMethod).toBe('ADJUSTMENT');
  });

  it('rejects a loan that is not ACTIVE (e.g. still PENDING_APPROVAL)', async () => {
    const deps = buildDeps();
    const loan = LoanAccount.create({
      loanCode: 'SML-REG_00002',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      installmentCount: INSTALLMENT_COUNT,
      firstRepaymentDate: FIRST_REPAYMENT_DATE,
    });
    deps.loanAccountRepository.findById.mockResolvedValue(loan);

    const useCase = new AdjustLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: loan.id, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, adjustedByUserId: 'staff-1' }),
    ).rejects.toThrow(LoanNotEligibleForAdjustmentError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects a loan with at least one payment already recorded', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    const paidInstallment = RepaymentInstallment.create({
      loanAccountId: loan.id,
      installmentNumber: 1,
      dueDate: FIRST_REPAYMENT_DATE,
      due: InstallmentAmounts.of({ principal: Money.of('4166.67'), interest: Money.of('145.83') }),
    });
    paidInstallment.recordPayment(InstallmentAmounts.of({ principal: Money.of('4166.67'), interest: Money.of('145.83') }), new Date());
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([paidInstallment]);

    const useCase = new AdjustLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: loan.id, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, adjustedByUserId: 'staff-1' }),
    ).rejects.toThrow(LoanNotEligibleForAdjustmentError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects a loan whose first installment is already due or past due', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan({ firstRepaymentDate: new Date('2020-01-15T00:00:00.000Z') });
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([buildUnpaidInstallment(loan.id, 1, new Date('2020-01-15T00:00:00.000Z'))]);

    const useCase = new AdjustLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: loan.id, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, adjustedByUserId: 'staff-1' }),
    ).rejects.toThrow(LoanNotEligibleForAdjustmentError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('rejects a loan already adjusted once — "isang beses lang pwede gawin per loan account"', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.loanAdjustmentRepository.findByOldLoanAccountId.mockResolvedValue(
      LoanAdjustment.create({
        oldLoanAccountId: loan.id,
        newLoanAccountId: 'new-loan-1',
        previousFirstRepaymentDate: FIRST_REPAYMENT_DATE,
        newFirstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
        adjustedByUserId: 'staff-0',
      }),
    );

    const useCase = new AdjustLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: loan.id, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, adjustedByUserId: 'staff-1' }),
    ).rejects.toThrow(LoanAlreadyAdjustedError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(null);

    const useCase = new AdjustLoanUseCase(deps);
    await expect(
      useCase.execute({ oldLoanAccountId: 'missing', firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, adjustedByUserId: 'staff-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('performs every write inside one IUnitOfWork.run() call, sharing the same ctx', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);

    const useCase = new AdjustLoanUseCase(deps);
    await useCase.execute({ oldLoanAccountId: loan.id, firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE, adjustedByUserId: 'staff-1' });

    expect(deps.unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, mockCtx);
    expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith(expect.any(Array), mockCtx);
    expect(deps.loanTransactionRepository.create).toHaveBeenCalledWith(expect.anything(), mockCtx);
    expect(deps.loanAdjustmentRepository.create).toHaveBeenCalledWith(expect.anything(), mockCtx);
    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(expect.anything(), mockCtx);
  });

  it('notifies staff LOAN_RESCHEDULED and LOAN_CLOSED (2026-09-03, event-driven redesign)', async () => {
    const deps = buildDeps();
    const loan = buildActiveLoan();
    primeHappyPath(deps, loan);
    const notifyStaff = vi.fn();

    const useCase = new AdjustLoanUseCase({ ...deps, notificationService: { notifyStaff } as never });
    const { newLoanAccount } = await useCase.execute({
      oldLoanAccountId: loan.id,
      firstRepaymentDate: NEW_FIRST_REPAYMENT_DATE,
      adjustedByUserId: 'staff-1',
    });

    expect(notifyStaff).toHaveBeenCalledTimes(2);
    const types = notifyStaff.mock.calls.map((c) => c[0].type);
    expect(types).toEqual(['LOAN_RESCHEDULED', 'LOAN_CLOSED']);
    expect(notifyStaff.mock.calls.every((c) => c[0].entityId === loan.id && c[0].branchId === 'branch-1')).toBe(true);
    expect(notifyStaff.mock.calls[0][0].title).toContain(newLoanAccount.loanCode);
  });
});
