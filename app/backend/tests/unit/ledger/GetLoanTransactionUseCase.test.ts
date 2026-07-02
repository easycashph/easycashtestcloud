import { describe, expect, it, vi } from 'vitest';
import { GetLoanTransactionUseCase } from '@modules/ledger/application/use-cases/GetLoanTransactionUseCase';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { Money } from '@shared/domain/Money';
import { NotFoundError } from '@shared/errors/DomainError';

function buildTransaction() {
  return LoanTransaction.create({
    loanAccountId: 'loan-1',
    type: 'DISBURSEMENT',
    amount: Money.of('10000.00'),
    components: { principalComponent: Money.of('10000.00') },
    balanceAfter: Money.of('10000.00'),
    branchId: 'branch-1',
    entryDate: new Date(),
  });
}

describe('GetLoanTransactionUseCase', () => {
  it('returns the transaction when found', async () => {
    const transaction = buildTransaction();
    const loanTransactionRepository = { findById: vi.fn().mockResolvedValue(transaction), findByLoanAccountId: vi.fn(), create: vi.fn() };
    const useCase = new GetLoanTransactionUseCase({ loanTransactionRepository });

    await expect(useCase.execute(transaction.id)).resolves.toBe(transaction);
  });

  it('throws NotFoundError when the transaction does not exist', async () => {
    const loanTransactionRepository = { findById: vi.fn().mockResolvedValue(null), findByLoanAccountId: vi.fn(), create: vi.fn() };
    const useCase = new GetLoanTransactionUseCase({ loanTransactionRepository });

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
