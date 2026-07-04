import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessPaymentUseCase } from '@modules/loan-account/application/use-cases/ProcessPaymentUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';
import { InvalidPaymentAllocationInputError } from '@shared/domain/calculation/errors/CalculationDomainErrors';
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
  dueDate: string,
  due: { principal: string; interest: string },
  paid: { principal: string; interest: string } = { principal: '0', interest: '0' },
) {
  return RepaymentInstallment.reconstitute({
    id: `installment-${installmentNumber}`,
    loanAccountId: 'loan-1',
    installmentNumber,
    dueDate: new Date(dueDate),
    due: InstallmentAmounts.of({ principal: Money.of(due.principal), interest: Money.of(due.interest) }),
    paid: InstallmentAmounts.of({ principal: Money.of(paid.principal), interest: Money.of(paid.interest) }),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  });
}

const mockCtx = { __brand: 'TransactionContext' } as TransactionContext;

function buildDeps() {
  const loanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn(), save: vi.fn() };
  const repaymentInstallmentRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
  const loanTransactionRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn(), create: vi.fn() };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn(async (work: (ctx: TransactionContext) => Promise<unknown>) => work(mockCtx)) };

  return { loanAccountRepository, repaymentInstallmentRepository, loanTransactionRepository, financialAuditLogger, unitOfWork };
}

describe('ProcessPaymentUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(null);
    const useCase = new ProcessPaymentUseCase(deps);

    await expect(useCase.execute('missing-loan', Money.of('100.00'), 'officer-1')).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  // Validation deliberately delegated to PaymentAllocationService.allocate(),
  // not duplicated here — this confirms the delegation actually happens.
  it('rejects a non-positive paymentAmount via PaymentAllocationService, not a duplicate check', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(buildActiveLoan('3000.00', '450.00'));
    deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([]);
    const useCase = new ProcessPaymentUseCase(deps);

    await expect(useCase.execute('loan-1', Money.of('0.00'), 'officer-1')).rejects.toThrow(InvalidPaymentAllocationInputError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  describe('cross-installment allocation (ADR-009 §2: oldest due first)', () => {
    it('allocates across multiple installments in due-date order regardless of array input order, exhausting fees->penalty->interest->principal per installment', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('3000.00', '450.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const inst1 = buildInstallment(1, '2026-08-15', { principal: '1000.00', interest: '200.00' });
      const inst2 = buildInstallment(2, '2026-09-15', { principal: '1000.00', interest: '150.00' });
      const inst3 = buildInstallment(3, '2026-10-15', { principal: '1000.00', interest: '100.00' });
      // Deliberately shuffled — the use case must sort by dueDate itself.
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst3, inst1, inst2]);

      const useCase = new ProcessPaymentUseCase(deps);
      // Fully pays installment 1 (1200.00) plus installment 2's interest tier (100.00 of 150.00 due).
      const result = await useCase.execute('loan-1', Money.of('1300.00'), 'officer-1');

      expect(inst1.paid.principal.equals(Money.of('1000.00'))).toBe(true);
      expect(inst1.paid.interest.equals(Money.of('200.00'))).toBe(true);
      expect(inst2.paid.interest.equals(Money.of('100.00'))).toBe(true);
      expect(inst2.paid.principal.isZero()).toBe(true);
      expect(inst3.paid.principal.isZero()).toBe(true);
      expect(inst3.paid.interest.isZero()).toBe(true);

      expect(result.remainder.isZero()).toBe(true);

      // Only the two installments the payment actually reached are saved —
      // the untouched third installment is left alone (no write, no version bump).
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledTimes(1);
      const saved = deps.repaymentInstallmentRepository.saveMany.mock.calls[0]?.[0];
      expect(saved).toHaveLength(2);
      expect(saved.map((i: RepaymentInstallment) => i.id)).toEqual(['installment-1', 'installment-2']);
    });

    it('excludes already-PAID installments from allocation', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('1000.00', '100.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const paidInstallment = buildInstallment(1, '2026-08-15', { principal: '500.00', interest: '50.00' }, { principal: '500.00', interest: '50.00' });
      const unpaidInstallment = buildInstallment(2, '2026-09-15', { principal: '500.00', interest: '50.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([paidInstallment, unpaidInstallment]);

      const useCase = new ProcessPaymentUseCase(deps);
      await useCase.execute('loan-1', Money.of('550.00'), 'officer-1');

      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledTimes(1);
      const saved = deps.repaymentInstallmentRepository.saveMany.mock.calls[0]?.[0];
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('installment-2');
    });

    it('computes remaining due as due minus already-paid, not raw due, for a PARTIALLY_PAID installment', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('1000.00', '100.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      // Already has 300.00 of its 500.00 principal paid — remaining due is 200.00 principal + 50.00 interest.
      const partiallyPaid = buildInstallment(1, '2026-08-15', { principal: '500.00', interest: '50.00' }, { principal: '300.00', interest: '0.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([partiallyPaid]);

      const useCase = new ProcessPaymentUseCase(deps);
      const result = await useCase.execute('loan-1', Money.of('250.00'), 'officer-1');

      // 250.00 applied: interest tier (50.00) first, then principal tier (200.00) — exactly exhausts remaining due.
      expect(partiallyPaid.paid.interest.equals(Money.of('50.00'))).toBe(true);
      expect(partiallyPaid.paid.principal.equals(Money.of('500.00'))).toBe(true);
      expect(result.remainder.isZero()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('paymentAmount exactly matching total due across all installments leaves no remainder', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('2000.00', '300.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const inst1 = buildInstallment(1, '2026-08-15', { principal: '1000.00', interest: '150.00' });
      const inst2 = buildInstallment(2, '2026-09-15', { principal: '1000.00', interest: '150.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1, inst2]);

      const useCase = new ProcessPaymentUseCase(deps);
      const result = await useCase.execute('loan-1', Money.of('2300.00'), 'officer-1');

      expect(result.remainder.isZero()).toBe(true);
      expect(inst1.paid.principal.add(inst1.paid.interest).equals(Money.of('1150.00'))).toBe(true);
      expect(inst2.paid.principal.add(inst2.paid.interest).equals(Money.of('1150.00'))).toBe(true);
    });

    it('paymentAmount exceeding total due across all supplied installments surfaces the excess as remainder, never absorbed or discarded', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('2000.00', '300.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const inst1 = buildInstallment(1, '2026-08-15', { principal: '1000.00', interest: '150.00' });
      const inst2 = buildInstallment(2, '2026-09-15', { principal: '1000.00', interest: '150.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1, inst2]);

      const useCase = new ProcessPaymentUseCase(deps);
      const result = await useCase.execute('loan-1', Money.of('2500.00'), 'officer-1');

      expect(result.remainder.equals(Money.of('200.00'))).toBe(true);
      // Both installments are still fully paid — the excess is not distributed to them.
      expect(inst1.paid.principal.add(inst1.paid.interest).equals(Money.of('1150.00'))).toBe(true);
      expect(inst2.paid.principal.add(inst2.paid.interest).equals(Money.of('1150.00'))).toBe(true);
    });
  });

  describe('LoanAccount balance update and ledger entry', () => {
    it('applies the summed components to LoanAccount via applyPayment(), and records a REPAYMENT transaction for the applied amount only', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('2000.00', '300.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);

      const inst1 = buildInstallment(1, '2026-08-15', { principal: '1000.00', interest: '150.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);

      const useCase = new ProcessPaymentUseCase(deps);
      // 1300.00 paid against a single 1150.00-due installment -> 150.00 remainder, only 1150.00 applied.
      const result = await useCase.execute('loan-1', Money.of('1300.00'), 'officer-1');

      expect(result.loanAccount.balances.principalPaid.equals(Money.of('1000.00'))).toBe(true);
      expect(result.loanAccount.balances.interestPaid.equals(Money.of('150.00'))).toBe(true);

      expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
      const transaction = deps.loanTransactionRepository.create.mock.calls[0]?.[0];
      expect(transaction.type).toBe('REPAYMENT');
      expect(transaction.amount.equals(Money.of('1150.00'))).toBe(true);
      expect(transaction.amount.equals(Money.of('1300.00'))).toBe(false);
    });
  });

  describe('financial audit log entry (CP2, fail-closed) and IUnitOfWork atomicity', () => {
    it('writes a PROCESS_PAYMENT audit entry, sharing the same ctx as every other write', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('1000.00', '100.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      const inst1 = buildInstallment(1, '2026-08-15', { principal: '500.00', interest: '50.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);

      const useCase = new ProcessPaymentUseCase(deps);
      await useCase.execute('loan-1', Money.of('550.00'), 'officer-1');

      expect(deps.unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, mockCtx);
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledWith(expect.any(Array), mockCtx);
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledWith(expect.anything(), mockCtx);
      expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(expect.anything(), mockCtx);

      const [entry] = deps.financialAuditLogger.log.mock.calls[0] ?? [];
      expect(entry.action).toBe('PROCESS_PAYMENT');
      expect(entry.entityType).toBe('LoanAccount');
      expect(entry.entityId).toBe(loan.id);
      expect(entry.userId).toBe('officer-1');
    });

    // The key regression test for FINANCIAL_INVARIANTS.md §4's fail-closed
    // rule: an audit-log failure must abort the WHOLE transaction —
    // installment payments, the LoanAccount balance update, and the ledger
    // entry — never just be logged-and-continued. As with CP8's identical
    // test, real rollback of the three prior writes is PrismaUnitOfWork's
    // own guarantee (a single prisma.$transaction wrapping the whole
    // callback); what's proven at the unit level is that the audit
    // failure's rejection propagates all the way out of execute() without
    // being swallowed, after all three prior writes were attempted inside
    // the same transactional callback.
    it('propagates the error and aborts if the audit log write fails — the whole transaction rejects, not just the audit write', async () => {
      const deps = buildDeps();
      const loan = buildActiveLoan('1000.00', '100.00');
      deps.loanAccountRepository.findById.mockResolvedValue(loan);
      const inst1 = buildInstallment(1, '2026-08-15', { principal: '500.00', interest: '50.00' });
      deps.repaymentInstallmentRepository.findByLoanAccountId.mockResolvedValue([inst1]);
      const auditFailure = new Error('audit log write failed');
      deps.financialAuditLogger.log.mockRejectedValue(auditFailure);

      const useCase = new ProcessPaymentUseCase(deps);

      await expect(useCase.execute('loan-1', Money.of('550.00'), 'officer-1')).rejects.toThrow('audit log write failed');

      expect(deps.loanAccountRepository.save).toHaveBeenCalledTimes(1);
      expect(deps.repaymentInstallmentRepository.saveMany).toHaveBeenCalledTimes(1);
      expect(deps.loanTransactionRepository.create).toHaveBeenCalledTimes(1);
    });
  });
});
