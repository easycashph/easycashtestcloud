import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanAccountOps = { findUnique: vi.fn(), upsert: vi.fn() };
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
});
