import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivateLoanUseCase } from '@modules/loan-account/application/use-cases/ActivateLoanUseCase';
import { ProcessPaymentUseCase } from '@modules/loan-account/application/use-cases/ProcessPaymentUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { LoanProductVersion } from '@modules/loan-product/domain/LoanProductVersion';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { SL_LAZ_A6J8E, SL_LAZ_V5N0R, SL_REG_U1V1J } from './goldenMasterFixtures';

/**
 * Milestone 9.1 checkpoint 10 (`MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`,
 * Decision Log #20): golden-master replay tests. Distinct from CP3/CP4's
 * isolated unit tests — this exercises the FULL pipeline together
 * (`AmortizationScheduleGenerator` -> `PaymentAllocationService` ->
 * `LoanAccount`/`RepaymentInstallment` mutation), via the real
 * `ActivateLoanUseCase`/`ProcessPaymentUseCase` orchestrators, against real
 * hand-traced legacy loan figures (`goldenMasterFixtures.ts`), and asserts
 * the computed state matches those figures exactly, to the centavo.
 *
 * Repositories are still mocked (in-memory capture, not a real database) —
 * per the roadmap's Decision Log #10, live-Postgres verification remains a
 * standing, flagged risk for this project, not a blocking requirement; this
 * suite closes the calculation-correctness gap that doesn't need a real
 * database to verify, while leaving the transaction-atomicity gap as the
 * already-documented standing risk.
 *
 * Deliberately excludes ADR-046 (Advance Interest Fee) — none of these
 * three loans' evidence trails were checked against it, so no fee logic is
 * exercised or asserted here.
 */
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

function buildLoanProductVersion(interestCalculationMethod: 'DECLINING_BALANCE' | 'DECLINING_BALANCE_DISCOUNTED') {
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

async function activate(fixture: {
  principal: string;
  monthlyContractualRate: string;
  installmentCount: number;
  interestCalculationMethod: 'DECLINING_BALANCE' | 'DECLINING_BALANCE_DISCOUNTED';
  firstRepaymentDate: Date;
}) {
  const deps = buildDeps();
  const loan = LoanAccount.create({
    loanCode: 'LN-GOLDEN',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of(fixture.principal),
    interestRate: Percentage.of(fixture.monthlyContractualRate),
    installmentCount: fixture.installmentCount,
    firstRepaymentDate: fixture.firstRepaymentDate,
  });
  loan.approve('officer-1');
  deps.loanAccountRepository.findById.mockResolvedValue(loan);
  deps.loanProductRepository.findVersionById.mockResolvedValue(buildLoanProductVersion(fixture.interestCalculationMethod));

  const useCase = new ActivateLoanUseCase(deps);
  const activatedLoan = await useCase.execute(loan.id, 'officer-1');

  const installments: RepaymentInstallment[] = deps.repaymentInstallmentRepository.saveMany.mock.calls[0]?.[0] ?? [];
  return { deps, loan: activatedLoan, installments };
}

describe('Golden-Master Replay (Milestone 9.1 CP10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SL-REG_U1V1J — 6-installment DECLINING_BALANCE_DISCOUNTED, no penalties', () => {
    it('reproduces installment 1 and 2 interest_due exactly (CALC-SPEC §1, ADR-010 §8.3)', async () => {
      const { installments } = await activate(SL_REG_U1V1J);

      expect(installments).toHaveLength(SL_REG_U1V1J.installmentCount);
      const [installment1, installment2] = installments;

      expect(installment1?.due.interest.equals(Money.of(SL_REG_U1V1J.installment1InterestDue))).toBe(true);
      expect(installment1?.dueDate.toISOString()).toBe(SL_REG_U1V1J.firstRepaymentDate.toISOString());

      // installment 2's beginning principal (evidence: 15164.97) falls out
      // of the pipeline's own PMT/declining-balance computation, not
      // supplied directly by the fixture — asserting it independently
      // confirms the full chain (PMT payment -> principal portion -> ending
      // balance), not just the interest formula in isolation.
      const installment2BeginningPrincipal = Money.of(SL_REG_U1V1J.principal).subtract(installment1!.due.principal);
      expect(installment2BeginningPrincipal.equals(Money.of(SL_REG_U1V1J.installment2BeginningPrincipal))).toBe(true);
      expect(installment2?.due.interest.equals(Money.of(SL_REG_U1V1J.installment2InterestDue))).toBe(true);
    });

    it('allocates a partial payment interest-before-principal, matching the real REPAYMENT split exactly (ADR-009 §2)', async () => {
      const { deps, loan, installments } = await activate(SL_REG_U1V1J);
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue(installments);

      const useCase = new ProcessPaymentUseCase(deps);
      const { paymentAmount, expectedInterestApplied, expectedPrincipalApplied } = SL_REG_U1V1J.installment1Payment;
      const result = await useCase.execute(loan.id, Money.of(paymentAmount), 'officer-1');

      const [installment1] = installments;
      expect(installment1?.paid.interest.equals(Money.of(expectedInterestApplied))).toBe(true);
      expect(installment1?.paid.principal.equals(Money.of(expectedPrincipalApplied))).toBe(true);
      expect(result.remainder.isZero()).toBe(true);
    });
  });

  describe('SL-LAZ_V5N0R — single-installment DECLINING_BALANCE, rate 24.99%', () => {
    it('reproduces the exact INTEREST_APPLIED figure and reconciles to a zero balance on full repayment (ADR-007 §1 Case A)', async () => {
      const { deps, loan, installments } = await activate(SL_LAZ_V5N0R);

      const [installment1] = installments;
      expect(installment1?.due.interest.equals(Money.of(SL_LAZ_V5N0R.installment1InterestDue))).toBe(true);

      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue(installments);
      const useCase = new ProcessPaymentUseCase(deps);
      const result = await useCase.execute(loan.id, Money.of(SL_LAZ_V5N0R.fullRepaymentAmount), 'officer-1');

      expect(result.remainder.isZero()).toBe(true);
      expect(result.loanAccount.balances.principalBalance.isZero()).toBe(true);
      expect(result.loanAccount.balances.interestBalance.isZero()).toBe(true);
    });
  });

  describe('SL-LAZ_A6J8E — single-installment DECLINING_BALANCE, rate 24.99%', () => {
    it('reproduces the exact interest-applied figure and reconciles to a zero balance on full repayment (ADR-007 §1 Case B, pre-anomaly state)', async () => {
      const { deps, loan, installments } = await activate(SL_LAZ_A6J8E);

      const [installment1] = installments;
      expect(installment1?.due.interest.equals(Money.of(SL_LAZ_A6J8E.installment1InterestDue))).toBe(true);

      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue(installments);
      const useCase = new ProcessPaymentUseCase(deps);
      const result = await useCase.execute(loan.id, Money.of(SL_LAZ_A6J8E.fullRepaymentAmount), 'officer-1');

      expect(result.remainder.isZero()).toBe(true);
      expect(result.loanAccount.balances.principalBalance.isZero()).toBe(true);
      expect(result.loanAccount.balances.interestBalance.isZero()).toBe(true);
    });
  });
});
