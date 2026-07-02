import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanTransactionOps = { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() };
const prismaMock = { loanTransaction: loanTransactionOps };

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaLoanTransactionRepository } = await import('@modules/ledger/infrastructure/PrismaLoanTransactionRepository');
const { LoanTransaction } = await import('@modules/ledger/domain/LoanTransaction');
const { Money } = await import('@shared/domain/Money');

describe('PrismaLoanTransactionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create() writes a single row — no update/delete method exists on this class at all', async () => {
    const repo = new PrismaLoanTransactionRepository();
    expect((repo as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((repo as unknown as Record<string, unknown>).delete).toBeUndefined();

    const txn = LoanTransaction.create({
      loanAccountId: 'loan-1',
      type: 'DISBURSEMENT',
      amount: Money.of('10000.00'),
      components: { principalComponent: Money.of('10000.00') },
      balanceAfter: Money.of('10000.00'),
      branchId: 'branch-1',
      entryDate: new Date(),
    });

    await repo.create(txn);

    expect(loanTransactionOps.create).toHaveBeenCalledTimes(1);
  });

  it('findByLoanAccountId applies cursor pagination (skip: 1 past the cursor) when a cursor is given', async () => {
    loanTransactionOps.findMany.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20, cursor: 'txn-5' });

    expect(loanTransactionOps.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, cursor: { id: 'txn-5' }, skip: 1 }),
    );
  });

  it('findByLoanAccountId omits cursor/skip on the first page', async () => {
    loanTransactionOps.findMany.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20 });

    const callArgs = loanTransactionOps.findMany.mock.calls[0]?.[0];
    expect(callArgs.cursor).toBeUndefined();
    expect(callArgs.skip).toBeUndefined();
  });

  // Milestone 8.1 remediation (audit finding H-1).
  it('findByLoanAccountId filters by branchId when supplied (branch-scoped caller)', async () => {
    loanTransactionOps.findMany.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20, branchId: 'branch-1' });

    expect(loanTransactionOps.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loanAccountId: 'loan-1', branchId: 'branch-1' } }),
    );
  });

  it('findByLoanAccountId applies no branch filter when branchId is omitted (global caller)', async () => {
    loanTransactionOps.findMany.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20 });

    expect(loanTransactionOps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { loanAccountId: 'loan-1' } }));
  });
});
