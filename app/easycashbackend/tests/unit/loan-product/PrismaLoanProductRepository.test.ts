import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanProductOps = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() };
const loanProductVersionOps = { upsert: vi.fn(), findUnique: vi.fn() };
const penaltyRuleOps = { upsert: vi.fn() };
const feeRuleOps = { upsert: vi.fn() };

const prismaMock = {
  loanProduct: loanProductOps,
  loanProductVersion: loanProductVersionOps,
  penaltyRule: penaltyRuleOps,
  feeRule: feeRuleOps,
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaLoanProductRepository } = await import('@modules/loan-product/infrastructure/PrismaLoanProductRepository');
const { LoanProduct } = await import('@modules/loan-product/domain/LoanProduct');
const { LoanProductVersion } = await import('@modules/loan-product/domain/LoanProductVersion');
const { Money } = await import('@shared/domain/Money');

describe('PrismaLoanProductRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('wraps the multi-row product+version write in $transaction when no outer ctx is supplied', async () => {
      const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
      const version = LoanProductVersion.create({
        loanProductId: product.id,
        versionNumber: 1,
        effectiveFrom: new Date(),
        interestCalculationMethod: 'FLAT',
        loanAmountMin: Money.of('1000.00'),
        installmentCountMin: 6,
      });
      product.addVersion(version);

      const repo = new PrismaLoanProductRepository();
      await repo.save(product);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(loanProductOps.upsert).toHaveBeenCalledTimes(1);
      expect(loanProductVersionOps.upsert).toHaveBeenCalledTimes(1);
    });

    it('persists penaltyRule and feeRules alongside the version', async () => {
      const { PenaltyRule } = await import('@modules/loan-product/domain/PenaltyRule');
      const { FeeRule } = await import('@modules/loan-product/domain/FeeRule');

      const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
      const version = LoanProductVersion.create({
        loanProductId: product.id,
        versionNumber: 1,
        effectiveFrom: new Date(),
        interestCalculationMethod: 'FLAT',
        loanAmountMin: Money.of('1000.00'),
        installmentCountMin: 6,
        penaltyRule: PenaltyRule.create({ calculationMethod: 'OVERDUE_BALANCE_AND_INTEREST' }),
        feeRules: [FeeRule.create({ name: 'Processing Fee', calculationMethod: 'FLAT', triggerEvent: 'DISBURSEMENT' })],
      });
      product.addVersion(version);

      const repo = new PrismaLoanProductRepository();
      await repo.save(product);

      expect(penaltyRuleOps.upsert).toHaveBeenCalledTimes(1);
      expect(feeRuleOps.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('returns null when no row exists', async () => {
      loanProductOps.findUnique.mockResolvedValue(null);
      const repo = new PrismaLoanProductRepository();
      await expect(repo.findById('missing')).resolves.toBeNull();
    });
  });

  // Milestone 8 / D-4: cursor pagination only, no search/filter/sort.
  describe('findMany', () => {
    it('passes limit/cursor through to Prisma and orders by createdAt desc', async () => {
      loanProductOps.findMany.mockResolvedValue([]);
      const repo = new PrismaLoanProductRepository();

      await repo.findMany({ limit: 10, cursor: 'p-1' });

      expect(loanProductOps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, cursor: { id: 'p-1' }, skip: 1, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('omits cursor/skip on the first page', async () => {
      loanProductOps.findMany.mockResolvedValue([]);
      const repo = new PrismaLoanProductRepository();

      await repo.findMany({ limit: 10 });

      const callArgs = loanProductOps.findMany.mock.calls[0]?.[0];
      expect(callArgs.cursor).toBeUndefined();
      expect(callArgs.skip).toBeUndefined();
    });
  });

  // Milestone 8 / D-3: single-version lookup for range validation.
  describe('findVersionById', () => {
    it('returns null when no row exists', async () => {
      loanProductVersionOps.findUnique.mockResolvedValue(null);
      const repo = new PrismaLoanProductRepository();
      await expect(repo.findVersionById('missing')).resolves.toBeNull();
    });

    it('maps a found row without loading its parent product', async () => {
      loanProductVersionOps.findUnique.mockResolvedValue({
        id: 'v-1',
        loanProductId: 'p-1',
        versionNumber: 1,
        previousVersionId: null,
        isActive: true,
        effectiveFrom: new Date(),
        effectiveTo: null,
        interestCalculationMethod: 'FLAT',
        daysInYearConvention: 'E30_360',
        repaymentPeriodUnit: 'MONTHS',
        loanAmountMin: '1000.00',
        loanAmountMax: '50000.00',
        loanAmountDefault: null,
        installmentCountMin: 6,
        installmentCountMax: 24,
        installmentCountDefault: null,
        gracePeriodDefaultDays: 0,
        roundingMethod: 'NO_ROUNDING',
        repaymentAllocationOrder: null,
        defaultInterestRate: null,
        minInterestRate: null,
        maxInterestRate: null,
        legacyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        penaltyRule: null,
        feeRules: [],
      });
      const repo = new PrismaLoanProductRepository();

      const version = await repo.findVersionById('v-1');

      expect(loanProductOps.findUnique).not.toHaveBeenCalled();
      expect(version?.loanAmountMin.toString()).toBe('1000.00');
      expect(version?.loanAmountMax?.toString()).toBe('50000.00');
      expect(version?.installmentCountMax).toBe(24);
    });
  });
});
