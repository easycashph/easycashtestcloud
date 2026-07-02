import { describe, expect, it, vi } from 'vitest';
import { RecordLoanTransactionUseCase } from '@modules/ledger/application/use-cases/RecordLoanTransactionUseCase';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import { ComponentSumMismatchError } from '@modules/ledger/domain/errors/LedgerDomainErrors';

function buildRepo(): ILoanTransactionRepository {
  return { findById: vi.fn(), findByLoanAccountId: vi.fn(), create: vi.fn() };
}

describe('RecordLoanTransactionUseCase', () => {
  it('records an already-computed transaction via the append-only repository', async () => {
    const loanTransactionRepository = buildRepo();
    const useCase = new RecordLoanTransactionUseCase({ loanTransactionRepository });

    const txn = await useCase.execute({
      loanAccountId: 'loan-1',
      type: 'DISBURSEMENT',
      amount: '10000.00',
      principalComponent: '10000.00',
      balanceAfter: '10000.00',
      branchId: 'branch-1',
      entryDate: new Date(),
    });

    expect(loanTransactionRepository.create).toHaveBeenCalledWith(txn);
  });

  it('propagates ComponentSumMismatchError without recording anything', async () => {
    const loanTransactionRepository = buildRepo();
    const useCase = new RecordLoanTransactionUseCase({ loanTransactionRepository });

    await expect(
      useCase.execute({
        loanAccountId: 'loan-1',
        type: 'DISBURSEMENT',
        amount: '10000.00',
        principalComponent: '9000.00',
        balanceAfter: '10000.00',
        branchId: 'branch-1',
        entryDate: new Date(),
      }),
    ).rejects.toThrow(ComponentSumMismatchError);
    expect(loanTransactionRepository.create).not.toHaveBeenCalled();
  });
});
