import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanProductOps = { findUnique: vi.fn(), upsert: vi.fn() };
const loanProductVersionOps = { upsert: vi.fn() };
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
});
