import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivateLoanUseCase } from '@modules/loan-account/application/use-cases/ActivateLoanUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { InvalidStatusTransitionError, UnsupportedInterestCalculationMethodError } from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';
import { LoanProductVersion } from '@modules/loan-product/domain/LoanProductVersion';
import { AmortizationScheduleGenerator } from '@shared/domain/calculation/AmortizationScheduleGenerator';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';
import type { TransactionContext } from '@shared/application/TransactionContext';

// The CALC-SPEC §2 worked example (Sample Computation Sheet updated.xlsx),
// already used as CP3's own real-data test vector — reused here so this
// checkpoint's orchestration test uses evidenced figures, not arbitrary ones.
const PRINCIPAL = Money.of('80953.71');
const RATE = Percentage.of('3.7');
const INSTALLMENT_COUNT = 8;
const FIRST_REPAYMENT_DATE = new Date('2026-08-15T00:00:00.000Z');

function buildApprovedLoan() {
  const loan = LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: PRINCIPAL,
    interestRate: RATE,
    installmentCount: INSTALLMENT_COUNT,
    firstRepaymentDate: FIRST_REPAYMENT_DATE,
  });
  loan.approve('officer-1');
  return loan;
}

function buildLoanProductVersion(interestCalculationMethod: 'DECLINING_BALANCE' | 'DECLINING_BALANCE_DISCOUNTED' | 'FLAT' = 'DECLINING_BALANCE') {
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

const mockCtx = { __brand: 'TransactionContext' } as TransactionContext;

function buildDeps() {
  const loanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn(), save: vi.fn() };
  const loanProductRepository = {
    findById: vi.fn(),
    findByCode: vi.fn(),
    findMany: vi.fn(),
    findVersionById: vi.fn(),
    save: vi.fn(),
  };
  const repaymentInstallmentRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
  const loanTransactionRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), create: vi.fn() };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn(async (work: (ctx: TransactionContext) => Promise<unknown>) => work(mockCtx)) };

  return {
    loanAccountRepository,
    loanProductRepository,
    repaymentInstallmentRepository,
    loanTransactionRepository,
    financialAuditLogger,
    unitOfWork,
  };
}

describe('ActivateLoanUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions APPROVED -> ACTIVE and sets balances from the calculation engine', async () => {
    const deps = buildDeps();
    const loan = buildApprovedLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

    const useCase = new ActivateLoanUseCase(deps);
    const result = await useCase.execute(loan.id, 'officer-1');

    expect(result.status).toBe('ACTIVE');
    expect(result.balances.principalDue.equals(PRINCIPAL)).toBe(true);
    expect(result.balances.principalBalance.equals(PRINCIPAL)).toBe(true);
    expect(result.balances.principalPaid.isZero()).toBe(true);
  });

  it('sets interestDue to the sum of the generated schedule\'s interestPortions', async () => {
    const deps = buildDeps();
    const loan = buildApprovedLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

    const { schedule } = AmortizationScheduleGenerator.generate(PRINCIPAL, RATE, INSTALLMENT_COUNT);
    const expectedInterestDue = schedule.reduce((total, entry) => total.add(entry.interestPortion), Money.ZERO);

    const useCase = new ActivateLoanUseCase(deps);
    const result = await useCase.execute(loan.id, 'officer-1');

    expect(result.balances.interestDue.equals(expectedInterestDue)).toBe(true);
  });

  it('uses LoanAccount.interestRate for amortization, not contractualInterestRate, even when they diverge (ADR-010 §1)', async () => {
    // Regression test: ADR-010 §1 names `LoanAccount.interestRate` itself as
    // the `MonthlyContractualRate` the amortization formula requires.
    // `contractualInterestRate`/`addOnInterestRate` are optional,
    // disclosure-oriented fields (ADR-010 §1 items 3-4) that may not be
    // populated on every loan, or may be populated with a different tier
    // than `interestRate` for a loan originated via the Add-On-quoted path.
    // An earlier version of this use case incorrectly preferred
    // `contractualInterestRate` over `interestRate` when both were present
    // — this test constructs a loan where they deliberately diverge and
    // asserts `interestRate` (RATE, 3.7%) is what's actually used, not the
    // divergent `contractualInterestRate` (10%, which is not evidenced
    // anywhere as this loan's real contractual rate).
    const deps = buildDeps();
    const loan = LoanAccount.create({
      loanCode: 'LN-0002',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      contractualInterestRate: Percentage.of('10'),
      installmentCount: INSTALLMENT_COUNT,
      firstRepaymentDate: FIRST_REPAYMENT_DATE,
    });
    loan.approve('officer-1');
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

    const { schedule: expectedSchedule } = AmortizationScheduleGenerator.generate(PRINCIPAL, RATE, INSTALLMENT_COUNT);
    const expectedInterestDue = expectedSchedule.reduce((total, entry) => total.add(entry.interestPortion), Money.ZERO);
    const { schedule: wrongRateSchedule } = AmortizationScheduleGenerator.generate(PRINCIPAL, Percentage.of('10'), INSTALLMENT_COUNT);
    const wrongRateInterestDue = wrongRateSchedule.reduce((total, entry) => total.add(entry.interestPortion), Money.ZERO);

    const useCase = new ActivateLoanUseCase(deps);
    const result = await useCase.execute(loan.id, 'officer-1');

    expect(result.balances.interestDue.equals(expectedInterestDue)).toBe(true);
    expect(result.balances.interestDue.equals(wrongRateInterestDue)).toBe(false);
  });

  it('leaves feesDue/penaltyDue at zero — no fee-application logic is invented (ADR-046 excluded)', async () => {
    const deps = buildDeps();
    const loan = buildApprovedLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

    const useCase = new ActivateLoanUseCase(deps);
    const result = await useCase.execute(loan.id, 'officer-1');

    expect(result.balances.feesDue.isZero()).toBe(true);
    expect(result.balances.penaltyDue.isZero()).toBe(true);
  });

  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(null);
    const useCase = new ActivateLoanUseCase(deps);

    await expect(useCase.execute('missing-loan', 'officer-1')).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the referenced LoanProductVersion does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildApprovedLoan());
    deps.loanProductRepository.findVersionById.mockResolvedValue(null);
    const useCase = new ActivateLoanUseCase(deps);

    await expect(useCase.execute('loan-1', 'officer-1')).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('throws UnsupportedInterestCalculationMethodError for a FLAT-rate product (CALC-SPEC §4 UNRESOLVED)', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildApprovedLoan());
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion('FLAT'));
    const useCase = new ActivateLoanUseCase(deps);

    await expect(useCase.execute('loan-1', 'officer-1')).rejects.toThrow(UnsupportedInterestCalculationMethodError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('does not special-case DECLINING_BALANCE_DISCOUNTED — identical to DECLINING_BALANCE (ADR-010 §5)', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildApprovedLoan());
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion('DECLINING_BALANCE_DISCOUNTED'));
    const useCase = new ActivateLoanUseCase(deps);

    await expect(useCase.execute('loan-1', 'officer-1')).resolves.toBeDefined();
  });

  it('throws InvalidStatusTransitionError when the loan is not APPROVED', async () => {
    const deps = buildDeps();
    const pendingLoan = LoanAccount.create({
      loanCode: 'LN-0002',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      installmentCount: INSTALLMENT_COUNT,
      firstRepaymentDate: FIRST_REPAYMENT_DATE,
    });
    deps.loanAccountRepository.findById.mockResolvedValue(pendingLoan);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());
    const useCase = new ActivateLoanUseCase(deps);

    await expect(useCase.execute('loan-1', 'officer-1')).rejects.toThrow(InvalidStatusTransitionError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  describe('schedule generation, anchored on firstRepaymentDate (ADR-045)', () => {
    it('generates one RepaymentInstallment per period, due dates spaced by calendar month from firstRepaymentDate', async () => {
      const deps = buildDeps();
      const loan = buildApprovedLoan();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

      const useCase = new ActivateLoanUseCase(deps);
      await useCase.execute(loan.id, 'officer-1');

      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledTimes(1);
      const installments = deps.repaymentInstallmentRepository.saveMany.mock.calls[0]?.[0];
      expect(installments).toHaveLength(INSTALLMENT_COUNT);

      expect(installments[0].installmentNumber).toBe(1);
      expect(installments[0].dueDate.toISOString()).toBe(FIRST_REPAYMENT_DATE.toISOString());
      expect(installments[1].dueDate.toISOString()).toBe(new Date('2026-09-15T00:00:00.000Z').toISOString());
      expect(installments[7].dueDate.toISOString()).toBe(new Date('2027-03-15T00:00:00.000Z').toISOString());
    });

    it('clamps to the last day of a shorter month when the anchor day does not exist there', async () => {
      const deps = buildDeps();
      const loan = LoanAccount.create({
        loanCode: 'LN-0003',
        borrowerId: 'borrower-1',
        loanProductVersionId: 'version-1',
        branchId: 'branch-1',
        principalAmount: PRINCIPAL,
        interestRate: RATE,
        installmentCount: INSTALLMENT_COUNT,
        firstRepaymentDate: new Date('2026-01-31T00:00:00.000Z'),
      });
      loan.approve('officer-1');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

      const useCase = new ActivateLoanUseCase(deps);
      await useCase.execute(loan.id, 'officer-1');

      const installments = deps.repaymentInstallmentRepository.saveMany.mock.calls[0]?.[0];
      // Jan 31 + 1 month -> Feb 28 (2026 is not a leap year), not Mar 3.
      expect(installments[1].dueDate.toISOString()).toBe(new Date('2026-02-28T00:00:00.000Z').toISOString());
    });
  });

  describe('DISBURSEMENT ledger entry', () => {
    it('creates a DISBURSEMENT transaction with amount/balanceAfter equal to the disbursed principal', async () => {
      const deps = buildDeps();
      const loan = buildApprovedLoan();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

      const useCase = new ActivateLoanUseCase(deps);
      await useCase.execute(loan.id, 'officer-1');

      expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
      const transaction = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
      expect(transaction.type).toBe('DISBURSEMENT');
      expect(transaction.amount.equals(PRINCIPAL)).toBe(true);
      expect(transaction.balanceAfter.equals(PRINCIPAL)).toBe(true);
      expect(transaction.branchId).toBe('branch-1');
    });
  });

  describe('financial audit log entry (CP2, fail-closed)', () => {
    it('writes an ACTIVATE_LOAN audit entry', async () => {
      const deps = buildDeps();
      const loan = buildApprovedLoan();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

      const useCase = new ActivateLoanUseCase(deps);
      await useCase.execute(loan.id, 'officer-1');

      expect(deps.financialAuditLogger.log).toHaveBeenCalledTimes(1);
      const [entry] = deps.financialAuditLogger.log.mock.calls[0] ?? [];
      expect(entry.action).toBe('ACTIVATE_LOAN');
      expect(entry.entityType).toBe('LoanAccount');
      expect(entry.entityId).toBe(loan.id);
      expect(entry.userId).toBe('officer-1');
    });
  });

  describe('IUnitOfWork atomicity', () => {
    it('performs LoanAccount save, schedule saveMany, ledger create, and audit log all inside one IUnitOfWork.run() call, sharing the same ctx', async () => {
      const deps = buildDeps();
      const loan = buildApprovedLoan();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());

      const useCase = new ActivateLoanUseCase(deps);
      await useCase.execute(loan.id, 'officer-1');

      expect(deps.unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, mockCtx);
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith(expect.any(Array), mockCtx);
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledWith(expect.anything(), mockCtx);
      expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(expect.anything(), mockCtx);
    });

    // The key regression test for FINANCIAL_INVARIANTS.md §4's fail-closed
    // rule: an audit-log failure must abort the WHOLE transaction (the
    // LoanAccount activation, the generated schedule, and the ledger
    // entry), never just be logged-and-continued. Since this is a unit
    // test against a mocked IUnitOfWork (no real Postgres), what's proven
    // here is that a rejection inside the transactional callback — thrown
    // by the LAST write, after the other three have already run — still
    // propagates all the way out of execute() and is never swallowed by
    // any code path in this use case. Real rollback of the three prior
    // writes is PrismaUnitOfWork's own guarantee (a single prisma.
    // $transaction wrapping the whole callback), exercised here by
    // asserting the callback's rejection is not caught.
    it('propagates the error and aborts if the audit log write fails — the whole transaction rejects, not just the audit write', async () => {
      const deps = buildDeps();
      const loan = buildApprovedLoan();
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());
      const auditFailure = new Error('audit log write failed');
      deps.financialAuditLogger.log.mockRejectedValue(auditFailure);

      const useCase = new ActivateLoanUseCase(deps);

      await expect(useCase.execute(loan.id, 'officer-1')).rejects.toThrow('audit log write failed');

      // All three prior writes were attempted inside the same transactional
      // callback before the audit write failed — proving they share the
      // one atomic unit, not that the audit failure was detected too late
      // to matter.
      expect(deps.loanAccountRepository.save).toHaveBeenCalledTimes(1);
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledTimes(1);
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  it('notifies the linked Portal account with a detailed title (2026-08-14 user request)', async () => {
    const deps = buildDeps();
    const loan = buildApprovedLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion());
    const portalAccountRepository = { findByBorrowerId: vi.fn().mockResolvedValue({ id: 'portal-account-1' }) };
    const portalNotificationService = { notify: vi.fn().mockResolvedValue(undefined) };
    const userRepository = { findById: vi.fn().mockResolvedValue({ firstName: 'Maria', lastName: 'Santos' }) };

    const useCase = new ActivateLoanUseCase({ ...deps, portalAccountRepository, portalNotificationService, userRepository });
    await useCase.execute(loan.id, 'officer-1');

    expect(portalNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        portalAccountId: 'portal-account-1',
        type: 'LOAN_ACCOUNT_DISBURSED',
        title: 'LOAN ACCOUNT DISBURSED: LN-0001 has been disbursed by Maria Santos',
      }),
    );
  });
});
