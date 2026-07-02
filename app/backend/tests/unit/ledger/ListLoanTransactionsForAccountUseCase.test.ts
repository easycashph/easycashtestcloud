import { describe, expect, it, vi } from 'vitest';
import { ListLoanTransactionsForAccountUseCase } from '@modules/ledger/application/use-cases/ListLoanTransactionsForAccountUseCase';

describe('ListLoanTransactionsForAccountUseCase (ADR-042 §6/§11: always paginated)', () => {
  it('passes the requested limit through when within bounds', async () => {
    const loanTransactionRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn().mockResolvedValue([]), create: vi.fn() };
    const useCase = new ListLoanTransactionsForAccountUseCase({ loanTransactionRepository });

    await useCase.execute('loan-1', 20, 'cursor-1');

    expect(loanTransactionRepository.findByLoanAccountId).toHaveBeenCalledWith(
      'loan-1',
      { limit: 20, cursor: 'cursor-1' },
    );
  });

  it('caps an excessive requested limit at MAX_LIMIT rather than allowing an unbounded read', async () => {
    const loanTransactionRepository = { findById: vi.fn(), findByLoanAccountId: vi.fn().mockResolvedValue([]), create: vi.fn() };
    const useCase = new ListLoanTransactionsForAccountUseCase({ loanTransactionRepository });

    await useCase.execute('loan-1', 100000);

    const [, options] = loanTransactionRepository.findByLoanAccountId.mock.calls[0] as [string, { limit: number }];
    expect(options.limit).toBeLessThanOrEqual(200);
  });
});
