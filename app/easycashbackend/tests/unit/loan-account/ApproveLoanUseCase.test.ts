import { describe, expect, it, vi } from 'vitest';
import { ApproveLoanUseCase } from '@modules/loan-account/application/use-cases/ApproveLoanUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';

function buildLoan() {
  return LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 12,
    firstRepaymentDate: new Date('2026-08-15'),
  });
}

function buildDeps(loan: LoanAccount) {
  const loanAccountRepository = { findById: vi.fn().mockResolvedValue(loan), findByLoanCode: vi.fn(), save: vi.fn() };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn((work: (ctx: undefined) => Promise<unknown>) => work(undefined)) };
  return { loanAccountRepository, financialAuditLogger, unitOfWork };
}

describe('ApproveLoanUseCase (2026-07-08: wraps save + audit log in one IUnitOfWork.run(), M-8 fix)', () => {
  it('approves and saves the loan account', async () => {
    const loan = buildLoan();
    const deps = buildDeps(loan);
    const useCase = new ApproveLoanUseCase(deps);

    await useCase.execute(loan.id, 'officer-1');

    expect(loan.status).toBe('APPROVED');
    expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, undefined);
  });

  it('writes a financial audit log entry for the approval', async () => {
    const loan = buildLoan();
    const deps = buildDeps(loan);
    const useCase = new ApproveLoanUseCase(deps);

    await useCase.execute(loan.id, 'officer-1');

    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'officer-1',
        action: 'APPROVE_LOAN',
        entityType: 'LoanAccount',
        entityId: loan.id,
        previousValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED' },
      }),
      undefined,
    );
  });

  it('fails closed: if the audit write throws, the whole transaction (including the save) rolls back', async () => {
    const loan = buildLoan();
    const deps = buildDeps(loan);
    deps.financialAuditLogger.log.mockRejectedValue(new Error('audit write failed'));
    deps.unitOfWork.run = vi.fn(async (work: (ctx: undefined) => Promise<unknown>) => {
      // Mirrors PrismaUnitOfWork: a thrown error inside work() propagates,
      // and a real transaction would roll back every write inside it.
      return work(undefined);
    });
    const useCase = new ApproveLoanUseCase(deps);

    await expect(useCase.execute(loan.id, 'officer-1')).rejects.toThrow('audit write failed');
  });

  it('throws NotFoundError for an unknown loan account id', async () => {
    const loanAccountRepository = { findById: vi.fn().mockResolvedValue(null), findByLoanCode: vi.fn(), save: vi.fn() };
    const financialAuditLogger = { log: vi.fn() };
    const unitOfWork = { run: vi.fn() };
    const useCase = new ApproveLoanUseCase({ loanAccountRepository, financialAuditLogger, unitOfWork });

    await expect(useCase.execute('missing', 'officer-1')).rejects.toThrow(NotFoundError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });
});
