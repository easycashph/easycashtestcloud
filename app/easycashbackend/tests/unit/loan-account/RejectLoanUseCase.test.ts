import { describe, expect, it, vi } from 'vitest';
import { RejectLoanUseCase } from '@modules/loan-account/application/use-cases/RejectLoanUseCase';
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

describe('RejectLoanUseCase (2026-07-08: wraps save + audit log in one IUnitOfWork.run(), M-8 fix)', () => {
  it('rejects and saves the loan account with the given reason', async () => {
    const loan = buildLoan();
    const deps = buildDeps(loan);
    const useCase = new RejectLoanUseCase(deps);

    await useCase.execute(loan.id, 'officer-1', 'Insufficient documents');

    expect(loan.status).toBe('CLOSED_REJECTED');
    expect(deps.loanAccountRepository.save).toHaveBeenCalledWith(loan, undefined);
  });

  it('writes a financial audit log entry for the rejection, including the reason', async () => {
    const loan = buildLoan();
    const deps = buildDeps(loan);
    const useCase = new RejectLoanUseCase(deps);

    await useCase.execute(loan.id, 'officer-1', 'Insufficient documents');

    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'officer-1',
        action: 'REJECT_LOAN',
        entityType: 'LoanAccount',
        entityId: loan.id,
        previousValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'CLOSED_REJECTED', reason: 'Insufficient documents' },
      }),
      undefined,
    );
  });

  it('records a null reason when none was supplied', async () => {
    const loan = buildLoan();
    const deps = buildDeps(loan);
    const useCase = new RejectLoanUseCase(deps);

    await useCase.execute(loan.id, 'officer-1');

    expect(deps.financialAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: { status: 'CLOSED_REJECTED', reason: null } }),
      undefined,
    );
  });

  it('throws NotFoundError for an unknown loan account id', async () => {
    const loanAccountRepository = { findById: vi.fn().mockResolvedValue(null), findByLoanCode: vi.fn(), save: vi.fn() };
    const financialAuditLogger = { log: vi.fn() };
    const unitOfWork = { run: vi.fn() };
    const useCase = new RejectLoanUseCase({ loanAccountRepository, financialAuditLogger, unitOfWork });

    await expect(useCase.execute('missing', 'officer-1')).rejects.toThrow(NotFoundError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('notifies the linked Portal account with a detailed title (2026-08-14 user request)', async () => {
    const loan = buildLoan();
    const deps = buildDeps(loan);
    const portalAccountRepository = { findByBorrowerId: vi.fn().mockResolvedValue({ id: 'portal-account-1' }) };
    const portalNotificationService = { notify: vi.fn().mockResolvedValue(undefined) };
    const userRepository = { findById: vi.fn().mockResolvedValue({ firstName: 'Maria', lastName: 'Santos' }) };
    const useCase = new RejectLoanUseCase({ ...deps, portalAccountRepository, portalNotificationService, userRepository });

    await useCase.execute(loan.id, 'officer-1', 'Insufficient documents');

    expect(portalNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        portalAccountId: 'portal-account-1',
        type: 'LOAN_ACCOUNT_REJECTED',
        title: 'LOAN ACCOUNT REJECTED: LN-0001 has been rejected by Maria Santos',
        body: 'Insufficient documents',
      }),
    );
  });
});
