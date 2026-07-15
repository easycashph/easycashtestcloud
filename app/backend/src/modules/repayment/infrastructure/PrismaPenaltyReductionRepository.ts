import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { PenaltyReduction, type PenaltyReductionProps } from '../domain/PenaltyReduction';
import type { IPenaltyReductionRepository } from '../application/ports/IPenaltyReductionRepository';

type PenaltyReductionRow = Prisma.PenaltyReductionGetPayload<Record<string, never>>;

function toDomain(row: PenaltyReductionRow): PenaltyReduction {
  const props: PenaltyReductionProps = {
    id: row.id,
    repaymentInstallmentId: row.repaymentInstallmentId,
    previousPenaltyAmount: Money.of(row.previousPenaltyAmount),
    newPenaltyAmount: Money.of(row.newPenaltyAmount),
    reason: row.reason,
    reducedByUserId: row.reducedByUserId,
    createdAt: row.createdAt,
  };
  return PenaltyReduction.reconstitute(props);
}

export class PrismaPenaltyReductionRepository implements IPenaltyReductionRepository {
  async create(reduction: PenaltyReduction, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.penaltyReduction.create({
      data: {
        id: reduction.id,
        repaymentInstallmentId: reduction.repaymentInstallmentId,
        previousPenaltyAmount: reduction.previousPenaltyAmount.toDecimal(),
        newPenaltyAmount: reduction.newPenaltyAmount.toDecimal(),
        reason: reduction.reason,
        reducedByUserId: reduction.reducedByUserId,
        createdAt: reduction.createdAt,
      },
    });
  }

  async findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<PenaltyReduction[]> {
    const client = resolveClient(ctx);
    const rows = await client.penaltyReduction.findMany({
      where: { repaymentInstallmentId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }
}
