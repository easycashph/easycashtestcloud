import { describe, expect, it, vi } from 'vitest';
import { CreateCoBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateCoBorrowerUseCase';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';

function buildRepo(): ICoBorrowerRepository {
  return { findById: vi.fn(), findByBorrowerId: vi.fn(), save: vi.fn() };
}

describe('CreateCoBorrowerUseCase', () => {
  it('creates and persists a new CoBorrower', async () => {
    const coBorrowerRepository = buildRepo();
    const useCase = new CreateCoBorrowerUseCase({ coBorrowerRepository });

    const coBorrower = await useCase.execute({ firstName: 'Maria', lastName: 'Santos', relationship: 'Spouse' });

    expect(coBorrower.relationship).toBe('Spouse');
    expect(coBorrowerRepository.save).toHaveBeenCalledWith(coBorrower);
  });

  // 2026-07-16 (ADR-015 resolved: per-Borrower, not per-LoanAccount).
  it('attaches the co-borrower directly to a client when borrowerId is supplied', async () => {
    const coBorrowerRepository = buildRepo();
    const useCase = new CreateCoBorrowerUseCase({ coBorrowerRepository });

    const coBorrower = await useCase.execute({ borrowerId: 'borrower-1', firstName: 'Maria', lastName: 'Santos' });

    expect(coBorrower.borrowerId).toBe('borrower-1');
  });

  it('leaves borrowerId undefined when not supplied (legacy per-loan-only attachment path)', async () => {
    const coBorrowerRepository = buildRepo();
    const useCase = new CreateCoBorrowerUseCase({ coBorrowerRepository });

    const coBorrower = await useCase.execute({ firstName: 'Maria', lastName: 'Santos' });

    expect(coBorrower.borrowerId).toBeUndefined();
  });
});
