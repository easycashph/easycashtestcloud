import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanAccountOps = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() };
const appliedFeeOps = { upsert: vi.fn() };
const loanAccountCoBorrowerOps = { deleteMany: vi.fn(), createMany: vi.fn() };

const prismaMock = {
  loanAccount: loanAccountOps,
  appliedFee: appliedFeeOps,
  loanAccountCoBorrower: loanAccountCoBorrowerOps,
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaLoanAccountRepository } = await import('@modules/loan-account/infrastructure/PrismaLoanAccountRepository');
const { LoanAccount } = await import('@modules/loan-account/domain/LoanAccount');
const { Money } = await import('@shared/domain/Money');
const { Percentage } = await import('@shared/domain/Percentage');

function buildLoan() {
  return LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 12,
  });
}

describe('PrismaLoanAccountRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('wraps the write in $transaction when no outer ctx is supplied', async () => {
      const loan = buildLoan();
      const repo = new PrismaLoanAccountRepository();

      await repo.save(loan);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(loanAccountOps.upsert).toHaveBeenCalledTimes(1);
    });

    it('always replaces the co-borrower join wholesale, even when empty', async () => {
      const loan = buildLoan();
      const repo = new PrismaLoanAccountRepository();

      await repo.save(loan);

      expect(loanAccountCoBorrowerOps.deleteMany).toHaveBeenCalledWith({ where: { loanAccountId: loan.id } });
      expect(loanAccountCoBorrowerOps.createMany).not.toHaveBeenCalled();
    });

    it('creates the join rows when co-borrowers are attached', async () => {
      const loan = buildLoan();
      loan.attachCoBorrower('cb-1');
      const repo = new PrismaLoanAccountRepository();

      await repo.save(loan);

      expect(loanAccountCoBorrowerOps.createMany).toHaveBeenCalledWith({
        data: [{ loanAccountId: loan.id, coBorrowerId: 'cb-1' }],
      });
    });
  });

  describe('findById', () => {
    it('returns null when no row exists', async () => {
      loanAccountOps.findUnique.mockResolvedValue(null);
      const repo = new PrismaLoanAccountRepository();
      await expect(repo.findById('missing')).resolves.toBeNull();
    });
  });

  // Milestone 8 / D-4: cursor pagination only, no search/filter/sort.
  describe('findMany', () => {
    it('passes limit/cursor through to Prisma and orders by createdAt desc', async () => {
      loanAccountOps.findMany.mockResolvedValue([]);
      const repo = new PrismaLoanAccountRepository();

      await repo.findMany({ limit: 25, cursor: 'la-1' });

      expect(loanAccountOps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25, cursor: { id: 'la-1' }, skip: 1, orderBy: { createdAt: 'desc' } }),
      );
    });

    // Milestone 8.1 remediation (audit finding H-1).
    it('filters by branchId when supplied (branch-scoped caller)', async () => {
      loanAccountOps.findMany.mockResolvedValue([]);
      const repo = new PrismaLoanAccountRepository();

      await repo.findMany({ limit: 25, branchId: 'branch-1' });

      expect(loanAccountOps.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: 'branch-1' } }));
    });

    it('applies no branch filter when branchId is omitted (global caller)', async () => {
      loanAccountOps.findMany.mockResolvedValue([]);
      const repo = new PrismaLoanAccountRepository();

      await repo.findMany({ limit: 25 });

      const callArgs = loanAccountOps.findMany.mock.calls[0]?.[0];
      expect(callArgs.where).toBeUndefined();
    });

    it('omits cursor/skip on the first page', async () => {
      loanAccountOps.findMany.mockResolvedValue([]);
      const repo = new PrismaLoanAccountRepository();

      await repo.findMany({ limit: 25 });

      const callArgs = loanAccountOps.findMany.mock.calls[0]?.[0];
      expect(callArgs.cursor).toBeUndefined();
      expect(callArgs.skip).toBeUndefined();
    });
  });
});
