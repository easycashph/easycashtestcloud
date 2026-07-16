import { describe, expect, it, vi } from 'vitest';
import { UndoApproveLoanUseCase } from '@modules/loan-account/application/use-cases/UndoApproveLoanUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';
import { InvalidStatusTransitionError } from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';

function buildApprovedLoan() {
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
  return loan;
}

function buildDeps(loan: LoanAccount | null) {
  const loanAccountRepository = { findById: vi.fn().mockResolvedValue(loan), findByLoanCode: vi.fn(), save: vi.fn() };
  const financialAuditLogger = { log: vi.fn() };
  const unitOfWork = { run: vi.fn((work: (ctx: undefined) => Promise<unknown>) => work(undefined)) };
  return { loanAccountRepository, financialAuditLogger, unitOfWork };
}

describe('UndoApproveLoanUseCase (2026-07-16, MIS-only safety net for an accidental Approve click)', () => {
  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps(null);
    const useCase = new UndoApproveLoanUseCase(deps);

    await expect(useCase.execute('missing-loan', 'mis-1')).rejects.toThrow(NotFoundError);
    expect(deps.unitOfWork.run).not.toHaveBeenCalled();
  });

  it('undoes the approval and saves the loan account', async () => {
    const loan = buildApprovedLoan();
    const deps = buildDeps(loan);
    const useCase = new UndoApproveLoanUseCase(deps);

    await useCase.execute(loan.id, 'mis-1');

    expect(loan.status).toBe('PENDING_APPROVAL');
    expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, undefined);
  });

  it('writes a financial audit log entry', async () => {
    const loan = buildApprovedLoan();
    const deps = buildDeps(loan);
    const useCase = new UndoApproveLoanUseCase(deps);

    await useCase.execute(loan.id, 'mis-1');

    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'mis-1',
        action: 'UNDO_APPROVE_LOAN',
        entityType: 'LoanAccount',
        entityId: loan.id,
        previousValue: { status: 'APPROVED' },
        newValue: { status: 'PENDING_APPROVAL' },
      }),
      undefined,
    );
  });

  it('propagates InvalidStatusTransitionError when the loan is not APPROVED', async () => {
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
    const deps = buildDeps(loan);
    const useCase = new UndoApproveLoanUseCase(deps);

    await expect(useCase.execute(loan.id, 'mis-1')).rejects.toThrow(InvalidStatusTransitionError);
    expect(deps.loanAccountRepository.save).not.toHaveBeenCalled();
  });
});
