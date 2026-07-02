import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { LoanProduct, type LoanProductProps } from '../domain/LoanProduct';
import { LoanProductVersion } from '../domain/LoanProductVersion';
import { PenaltyRule } from '../domain/PenaltyRule';
import { FeeRule } from '../domain/FeeRule';
import type { FindManyLoanProductsOptions, ILoanProductRepository } from '../application/ports/ILoanProductRepository';

const VERSION_INCLUDE = { penaltyRule: true, feeRules: true } satisfies Prisma.LoanProductVersionInclude;
const LOAN_PRODUCT_INCLUDE = {
  versions: { include: VERSION_INCLUDE },
} satisfies Prisma.LoanProductInclude;

type LoanProductRow = Prisma.LoanProductGetPayload<{ include: typeof LOAN_PRODUCT_INCLUDE }>;
type LoanProductVersionRow = Prisma.LoanProductVersionGetPayload<{ include: typeof VERSION_INCLUDE }>;
type PrismaWriteClient = PrismaClient | Prisma.TransactionClient;

/**
 * Shared by `toDomain()` (whole product graph) and
 * `findVersionById()` (Milestone 8 / D-3 — a single version, looked up
 * without loading its parent product, for range-validating a new
 * LoanAccount against the version it references).
 */
function toVersionDomain(versionRow: LoanProductVersionRow): LoanProductVersion {
  return LoanProductVersion.reconstitute({
    id: versionRow.id,
    loanProductId: versionRow.loanProductId,
    versionNumber: versionRow.versionNumber,
    previousVersionId: versionRow.previousVersionId ?? undefined,
    isActive: versionRow.isActive,
    effectiveFrom: versionRow.effectiveFrom,
    effectiveTo: versionRow.effectiveTo ?? undefined,
    interestCalculationMethod: versionRow.interestCalculationMethod,
    daysInYearConvention: versionRow.daysInYearConvention,
    repaymentPeriodUnit: versionRow.repaymentPeriodUnit,
    loanAmountMin: Money.of(versionRow.loanAmountMin),
    loanAmountMax: versionRow.loanAmountMax ? Money.of(versionRow.loanAmountMax) : undefined,
    loanAmountDefault: versionRow.loanAmountDefault ? Money.of(versionRow.loanAmountDefault) : undefined,
    installmentCountMin: versionRow.installmentCountMin,
    installmentCountMax: versionRow.installmentCountMax ?? undefined,
    installmentCountDefault: versionRow.installmentCountDefault ?? undefined,
    gracePeriodDefaultDays: versionRow.gracePeriodDefaultDays,
    roundingMethod: versionRow.roundingMethod,
    repaymentAllocationOrder: versionRow.repaymentAllocationOrder ?? undefined,
    defaultInterestRate: versionRow.defaultInterestRate ? Percentage.of(versionRow.defaultInterestRate) : undefined,
    minInterestRate: versionRow.minInterestRate ? Percentage.of(versionRow.minInterestRate) : undefined,
    maxInterestRate: versionRow.maxInterestRate ? Percentage.of(versionRow.maxInterestRate) : undefined,
    legacyId: versionRow.legacyId ?? undefined,
    createdAt: versionRow.createdAt,
    updatedAt: versionRow.updatedAt,
    penaltyRule: versionRow.penaltyRule
      ? PenaltyRule.reconstitute({
          id: versionRow.penaltyRule.id,
          calculationMethod: versionRow.penaltyRule.calculationMethod,
          ratePercent: versionRow.penaltyRule.ratePercent ? Percentage.of(versionRow.penaltyRule.ratePercent) : undefined,
          capPercent: versionRow.penaltyRule.capPercent ? Percentage.of(versionRow.penaltyRule.capPercent) : undefined,
          gracePeriodDays: versionRow.penaltyRule.gracePeriodDays,
        })
      : undefined,
    feeRules: versionRow.feeRules.map((feeRuleRow) =>
      FeeRule.reconstitute({
        id: feeRuleRow.id,
        name: feeRuleRow.name,
        calculationMethod: feeRuleRow.calculationMethod,
        triggerEvent: feeRuleRow.triggerEvent,
        applicationType: feeRuleRow.applicationType,
        flatAmount: feeRuleRow.flatAmount ? Money.of(feeRuleRow.flatAmount) : undefined,
        percentage: feeRuleRow.percentage ? Percentage.of(feeRuleRow.percentage) : undefined,
        isActive: feeRuleRow.isActive,
        legacyId: feeRuleRow.legacyId ?? undefined,
        createdAt: feeRuleRow.createdAt,
      }),
    ),
  });
}

function toDomain(row: LoanProductRow): LoanProduct {
  const props: LoanProductProps = {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    versions: row.versions.map(toVersionDomain),
  };
  return LoanProduct.reconstitute(props);
}

async function writeGraph(client: PrismaWriteClient, product: LoanProduct): Promise<void> {
  await client.loanProduct.upsert({
    where: { id: product.id },
    create: { id: product.id, code: product.code, name: product.name, description: product.description, createdAt: product.createdAt, updatedAt: product.updatedAt },
    update: { name: product.name, description: product.description, updatedAt: product.updatedAt },
  });

  for (const version of product.versions) {
    await client.loanProductVersion.upsert({
      where: { id: version.id },
      create: {
        id: version.id,
        loanProductId: version.loanProductId,
        versionNumber: version.versionNumber,
        previousVersionId: version.previousVersionId,
        isActive: version.isActive,
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
        interestCalculationMethod: version.interestCalculationMethod,
        daysInYearConvention: version.daysInYearConvention,
        repaymentPeriodUnit: version.repaymentPeriodUnit,
        loanAmountMin: version.loanAmountMin.toDecimal(),
        loanAmountMax: version.loanAmountMax?.toDecimal(),
        loanAmountDefault: version.loanAmountDefault?.toDecimal(),
        installmentCountMin: version.installmentCountMin,
        installmentCountMax: version.installmentCountMax,
        installmentCountDefault: version.installmentCountDefault,
        gracePeriodDefaultDays: version.gracePeriodDefaultDays,
        roundingMethod: version.roundingMethod,
        repaymentAllocationOrder: version.repaymentAllocationOrder as Prisma.InputJsonValue,
        defaultInterestRate: version.defaultInterestRate?.toDecimal(),
        minInterestRate: version.minInterestRate?.toDecimal(),
        maxInterestRate: version.maxInterestRate?.toDecimal(),
        legacyId: version.legacyId,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
      },
      // LPV-2: `isActive` is included here deliberately — this is the ONLY
      // write path for it (LoanProduct.activateVersion()), and every save()
      // call persists the whole in-memory graph's already-correct flags.
      update: {
        isActive: version.isActive,
        effectiveTo: version.effectiveTo,
        updatedAt: version.updatedAt,
      },
    });

    if (version.penaltyRule) {
      const penaltyRule = version.penaltyRule;
      await client.penaltyRule.upsert({
        where: { id: penaltyRule.id },
        create: {
          id: penaltyRule.id,
          loanProductVersionId: version.id,
          calculationMethod: penaltyRule.calculationMethod,
          ratePercent: penaltyRule.ratePercent?.toDecimal(),
          capPercent: penaltyRule.capPercent?.toDecimal(),
          gracePeriodDays: penaltyRule.gracePeriodDays,
        },
        update: {
          calculationMethod: penaltyRule.calculationMethod,
          ratePercent: penaltyRule.ratePercent?.toDecimal(),
          capPercent: penaltyRule.capPercent?.toDecimal(),
          gracePeriodDays: penaltyRule.gracePeriodDays,
        },
      });
    }

    for (const feeRule of version.feeRules) {
      await client.feeRule.upsert({
        where: { id: feeRule.id },
        create: {
          id: feeRule.id,
          loanProductVersionId: version.id,
          name: feeRule.name,
          calculationMethod: feeRule.calculationMethod,
          triggerEvent: feeRule.triggerEvent,
          applicationType: feeRule.applicationType,
          flatAmount: feeRule.flatAmount?.toDecimal(),
          percentage: feeRule.percentage?.toDecimal(),
          isActive: feeRule.isActive,
          legacyId: feeRule.legacyId,
          createdAt: feeRule.createdAt,
        },
        update: {
          name: feeRule.name,
          isActive: feeRule.isActive,
          flatAmount: feeRule.flatAmount?.toDecimal(),
          percentage: feeRule.percentage?.toDecimal(),
        },
      });
    }
  }
}

export class PrismaLoanProductRepository implements ILoanProductRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<LoanProduct | null> {
    const client = resolveClient(ctx);
    const row = await client.loanProduct.findUnique({ where: { id }, include: LOAN_PRODUCT_INCLUDE });
    return row ? toDomain(row) : null;
  }

  async findByCode(code: string, ctx?: TransactionContext): Promise<LoanProduct | null> {
    const client = resolveClient(ctx);
    const row = await client.loanProduct.findUnique({ where: { code }, include: LOAN_PRODUCT_INCLUDE });
    return row ? toDomain(row) : null;
  }

  /** Milestone 8 / D-3: single-version lookup, no parent product load. */
  async findVersionById(versionId: string, ctx?: TransactionContext): Promise<LoanProductVersion | null> {
    const client = resolveClient(ctx);
    const row = await client.loanProductVersion.findUnique({ where: { id: versionId }, include: VERSION_INCLUDE });
    return row ? toVersionDomain(row) : null;
  }

  /** Milestone 8 / D-4: cursor pagination only, no search/filter/sort. */
  async findMany(options: FindManyLoanProductsOptions, ctx?: TransactionContext): Promise<LoanProduct[]> {
    const client = resolveClient(ctx);
    const rows = await client.loanProduct.findMany({
      include: LOAN_PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomain);
  }

  async save(loanProduct: LoanProduct, ctx?: TransactionContext): Promise<void> {
    if (ctx) {
      // Already inside an outer IUnitOfWork transaction — join it rather
      // than opening a nested one (Prisma's TransactionClient has no
      // $transaction method of its own).
      await writeGraph(resolveClient(ctx), loanProduct);
      return;
    }
    // No outer transaction supplied — this save() call's own multi-row
    // write (product + versions + penalty/fee rules) must still be atomic.
    await prisma.$transaction((tx) => writeGraph(tx, loanProduct));
  }
}
