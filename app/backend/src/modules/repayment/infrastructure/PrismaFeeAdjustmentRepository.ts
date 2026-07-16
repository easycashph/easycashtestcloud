import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { FeeAdjustment, type FeeAdjustmentProps } from '../domain/FeeAdjustment';
import type { IFeeAdjustmentRepository } from '../application/ports/IFeeAdjustmentRepository';

type FeeAdjustmentRow = Prisma.FeeAdjustmentGetPayload<Record<string, never>>;

function toDomain(row: FeeAdjustmentRow): FeeAdjustment {
  const props: FeeAdjustmentProps = {
    id: row.id,
    repaymentInstallmentId: row.repaymentInstallmentId,
    previousFeesAmount: Money.of(row.previousFeesAmount),
    newFeesAmount: Money.of(row.newFeesAmount),
    reason: row.reason,
    adjustedByUserId: row.adjustedByUserId,
    createdAt: row.createdAt,
  };
  return FeeAdjustment.reconstitute(props);
}

export class PrismaFeeAdjustmentRepository implements IFeeAdjustmentRepository {
  async create(adjustment: FeeAdjustment, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.feeAdjustment.create({
      data: {
        id: adjustment.id,
        repaymentInstallmentId: adjustment.repaymentInstallmentId,
        previousFeesAmount: adjustment.previousFeesAmount.toDecimal(),
        newFeesAmount: adjustment.newFeesAmount.toDecimal(),
        reason: adjustment.reason,
        adjustedByUserId: adjustment.adjustedByUserId,
        createdAt: adjustment.createdAt,
      },
    });
  }

  async findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<FeeAdjustment[]> {
    const client = resolveClient(ctx);
    const rows = await client.feeAdjustment.findMany({
      where: { repaymentInstallmentId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }
}
