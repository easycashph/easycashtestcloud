import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanTransactionOps = { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() };
const queryRaw = vi.fn();
const prismaMock = { loanTransaction: loanTransactionOps, $queryRaw: queryRaw };

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

  // 2026-07-15: findByLoanAccountId's ordering moved to raw SQL (DATE(entryDate) DESC,
  // createdAt DESC, id DESC) so same-day REVERSAL/DISBURSEMENT transactions (real time-of-day
  // entryDate) no longer always outrank same-day REPAYMENTs (date-only, midnight entryDate) — see
  // that method's own doc comment. It now does an id-only raw query, then a normal findMany by
  // `id: { in }` reordered to match — this is what these tests exercise.
  it('findByLoanAccountId fetches ordered ids via raw SQL, then reorders the findMany result to match', async () => {
    queryRaw.mockResolvedValue([{ id: 'txn-b' }, { id: 'txn-a' }]);
    loanTransactionOps.findMany.mockResolvedValue([
      rowStub('txn-a'),
      rowStub('txn-b'),
    ]);
    const repo = new PrismaLoanTransactionRepository();

    const result = await repo.findByLoanAccountId('loan-1', { limit: 20 });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(loanTransactionOps.findMany).toHaveBeenCalledWith({ where: { id: { in: ['txn-b', 'txn-a'] } } });
    expect(result.map((t) => t.id)).toEqual(['txn-b', 'txn-a']);
  });

  it('findByLoanAccountId returns an empty array without a findMany call when no ids match', async () => {
    queryRaw.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    const result = await repo.findByLoanAccountId('loan-1', { limit: 20 });

    expect(result).toEqual([]);
    expect(loanTransactionOps.findMany).not.toHaveBeenCalled();
  });

  it('findByLoanAccountId includes a cursor clause in the raw query when a cursor is given', async () => {
    queryRaw.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20, cursor: 'txn-5' });

    const sqlCall = queryRaw.mock.calls[0]?.[0];
    expect(String(sqlCall.strings.join(''))).toContain('AND (DATE(lt."entryDate")');
    expect(sqlCall.values).toContain('txn-5');
  });

  it('findByLoanAccountId omits the cursor clause on the first page', async () => {
    queryRaw.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20 });

    const sqlCall = queryRaw.mock.calls[0]?.[0];
    expect(String(sqlCall.strings.join(''))).not.toContain('AND (DATE(lt."entryDate")');
  });

  // Milestone 8.1 remediation (audit finding H-1).
  it('findByLoanAccountId filters by branchId when supplied (branch-scoped caller)', async () => {
    queryRaw.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20, branchId: 'branch-1' });

    const sqlCall = queryRaw.mock.calls[0]?.[0];
    expect(String(sqlCall.strings.join(''))).toContain('AND lt."branchId"');
    expect(sqlCall.values).toContain('branch-1');
  });

  it('findByLoanAccountId applies no branch filter when branchId is omitted (global caller)', async () => {
    queryRaw.mockResolvedValue([]);
    const repo = new PrismaLoanTransactionRepository();

    await repo.findByLoanAccountId('loan-1', { limit: 20 });

    const sqlCall = queryRaw.mock.calls[0]?.[0];
    expect(String(sqlCall.strings.join(''))).not.toContain('AND lt."branchId"');
  });
});

function rowStub(id: string) {
  return {
    id,
    loanAccountId: 'loan-1',
    type: 'REPAYMENT',
    amount: '100.00',
    principalComponent: '100.00',
    interestComponent: '0.00',
    feesComponent: '0.00',
    penaltyComponent: '0.00',
    balanceAfter: '0.00',
    postedByUserId: null,
    branchId: 'branch-1',
    entryDate: new Date('2026-07-15T00:00:00Z'),
    comment: null,
    orNumber: null,
    arNumber: null,
    reversesTransactionId: null,
    legacyId: null,
    createdAt: new Date('2026-07-15T00:00:00Z'),
  };
}
