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

describe('ApproveLoanUseCase (single-aggregate — no IUnitOfWork needed)', () => {
  it('approves and saves the loan account', async () => {
    const loan = buildLoan();
    const loanAccountRepository = { findById: vi.fn().mockResolvedValue(loan), findByLoanCode: vi.fn(), save: vi.fn() };
    const useCase = new ApproveLoanUseCase({ loanAccountRepository });

    await useCase.execute(loan.id, 'officer-1');

    expect(loan.status).toBe('APPROVED');
    expect(loanAccountRepository.save).toHaveBeenCalledWith(loan);
  });

  it('throws NotFoundError for an unknown loan account id', async () => {
    const loanAccountRepository = { findById: vi.fn().mockResolvedValue(null), findByLoanCode: vi.fn(), save: vi.fn() };
    const useCase = new ApproveLoanUseCase({ loanAccountRepository });

    await expect(useCase.execute('missing', 'officer-1')).rejects.toThrow(NotFoundError);
  });
});
