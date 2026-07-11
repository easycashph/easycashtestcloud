import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanAccountOps = { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() };
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
const { ConcurrencyConflictError } = await import('@shared/errors/DomainError');

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

function buildExistingLoan(version: number) {
  return LoanAccount.reconstitute({
    id: 'loan-1',
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    status: 'PENDING_APPROVAL',
    principalAmount: Money.of('10000.00'),
    balances: buildLoan().balances,
    interestRate: Percentage.of('2.5'),
    installmentCount: 12,
    repaymentPeriodUnit: 'MONTHS',
    gracePeriodDays: 0,
    firstRepaymentDate: new Date('2026-08-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
    appliedFees: [],
    coBorrowerIds: [],
    version,
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
      expect(loanAccountOps.create).toHaveBeenCalledTimes(1);
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

    // Milestone 9.1 checkpoint 6 / ADR-048-optimistic-concurrency.
    describe('conditional write (checkpoint 6)', () => {
      it('a new aggregate (isNew) is INSERTed with version 0, not upserted', async () => {
        const loan = buildLoan();
        const repo = new PrismaLoanAccountRepository();

        await repo.save(loan);

        expect(loanAccountOps.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: loan.id, version: 0 }) }));
        expect(loanAccountOps.updateMany).not.toHaveBeenCalled();
      });

      it('an existing aggregate is updated via a conditional WHERE id = ? AND version = ? guard, incrementing version', async () => {
        const loan = buildExistingLoan(3);
        loanAccountOps.updateMany.mockResolvedValue({ count: 1 });
        const repo = new PrismaLoanAccountRepository();

        await repo.save(loan);

        expect(loanAccountOps.create).not.toHaveBeenCalled();
        expect(loanAccountOps.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: loan.id, version: 3 },
            data: expect.objectContaining({ version: { increment: 1 } }),
          }),
        );
      });

      it('throws ConcurrencyConflictError when the conditional update affects zero rows', async () => {
        const loan = buildExistingLoan(3);
        loanAccountOps.updateMany.mockResolvedValue({ count: 0 });
        const repo = new PrismaLoanAccountRepository();

        await expect(repo.save(loan)).rejects.toThrow(ConcurrencyConflictError);
      });

      it('does not touch AppliedFee/co-borrower writes when the conditional update loses the version race', async () => {
        const loan = buildExistingLoan(3);
        loanAccountOps.updateMany.mockResolvedValue({ count: 0 });
        const repo = new PrismaLoanAccountRepository();

        await expect(repo.save(loan)).rejects.toThrow(ConcurrencyConflictError);
        expect(appliedFeeOps.upsert).not.toHaveBeenCalled();
        expect(loanAccountCoBorrowerOps.deleteMany).not.toHaveBeenCalled();
      });
    });
  });

  describe('findById', () => {
    it('returns null when no row exists', async () => {
      loanAccountOps.findUnique.mockResolvedValue(null);
      const repo = new PrismaLoanAccountRepository();
      await expect(repo.findById('missing')).resolves.toBeNull();
    });

    // Milestone 9.1 checkpoint 5 / ADR-048-optimistic-concurrency: version must
    // be hydrated from the persisted row into the domain object — this is
    // the one new piece of read-mapping behavior this checkpoint adds.
    it('hydrates version from the persisted row', async () => {
      const now = new Date();
      loanAccountOps.findUnique.mockResolvedValue({
        id: 'loan-1',
        loanCode: 'LN-0001',
        borrowerId: 'borrower-1',
        loanProductVersionId: 'version-1',
        branchId: 'branch-1',
        loanOfficerId: null,
        status: 'PENDING_APPROVAL',
        principalAmount: '10000.00',
        principalBalance: '0.00',
        principalPaid: '0.00',
        principalDue: '0.00',
        interestRate: '2.5',
        addOnInterestRate: null,
        contractualInterestRate: null,
        interestBalance: '0.00',
        interestPaid: '0.00',
        interestDue: '0.00',
        feesBalance: '0.00',
        feesPaid: '0.00',
        feesDue: '0.00',
        penaltyBalance: '0.00',
        penaltyPaid: '0.00',
        penaltyDue: '0.00',
        installmentCount: 12,
        repaymentPeriodUnit: 'MONTHS',
        gracePeriodDays: 0,
        firstRepaymentDate: now,
        approvedAt: null,
        approvedByUserId: null,
        activatedAt: null,
        closedAt: null,
        closedReason: null,
        legacyId: null,
        createdAt: now,
        updatedAt: now,
        appliedFees: [],
        coBorrowers: [],
        version: 3,
      });
      const repo = new PrismaLoanAccountRepository();

      const loan = await repo.findById('loan-1');

      expect(loan?.version).toBe(3);
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
      expect(callArgs.where).toEqual({});
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

  describe('findMaxLoanCodeSequenceForPrefix (2026-07-11)', () => {
    it('returns 0 when no loan code matches the prefix', async () => {
      loanAccountOps.findMany.mockResolvedValue([]);
      const repo = new PrismaLoanAccountRepository();

      const max = await repo.findMaxLoanCodeSequenceForPrefix('SML-REG');

      expect(max).toBe(0);
      expect(loanAccountOps.findMany).toHaveBeenCalledWith({
        where: { loanCode: { startsWith: 'SML-REG_' } },
        select: { loanCode: true },
      });
    });

    it('returns the highest numeric suffix among matching loan codes', async () => {
      loanAccountOps.findMany.mockResolvedValue([{ loanCode: 'SML-REG_00012' }, { loanCode: 'SML-REG_00059' }, { loanCode: 'SML-REG_00003' }]);
      const repo = new PrismaLoanAccountRepository();

      const max = await repo.findMaxLoanCodeSequenceForPrefix('SML-REG');

      expect(max).toBe(59);
    });

    it('ignores a non-numeric or malformed suffix rather than throwing', async () => {
      loanAccountOps.findMany.mockResolvedValue([{ loanCode: 'SML-REG_OLD' }, { loanCode: 'SML-REG_00010' }]);
      const repo = new PrismaLoanAccountRepository();

      const max = await repo.findMaxLoanCodeSequenceForPrefix('SML-REG');

      expect(max).toBe(10);
    });
  });
});
