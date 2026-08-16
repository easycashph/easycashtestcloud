import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { FeeCharge, type FeeChargeProps } from '../domain/FeeCharge';
import type { IFeeChargeRepository, FeeChargeView } from '../application/ports/IFeeChargeRepository';

type FeeChargeRow = Prisma.FeeChargeGetPayload<Record<string, never>>;

function toDomain(row: FeeChargeRow): FeeCharge {
  const props: FeeChargeProps = {
    id: row.id,
    repaymentInstallmentId: row.repaymentInstallmentId,
    loanTransactionId: row.loanTransactionId,
    previousFeesAmount: Money.of(row.previousFeesAmount),
    newFeesAmount: Money.of(row.newFeesAmount),
    reason: row.reason,
    chargedByUserId: row.chargedByUserId,
    createdAt: row.createdAt,
  };
  return FeeCharge.reconstitute(props);
}

export class PrismaFeeChargeRepository implements IFeeChargeRepository {
  async create(charge: FeeCharge, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.feeCharge.create({
      data: {
        id: charge.id,
        repaymentInstallmentId: charge.repaymentInstallmentId,
        loanTransactionId: charge.loanTransactionId,
        previousFeesAmount: charge.previousFeesAmount.toDecimal(),
        newFeesAmount: charge.newFeesAmount.toDecimal(),
        reason: charge.reason,
        chargedByUserId: charge.chargedByUserId,
        createdAt: charge.createdAt,
      },
    });
  }

  async findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<FeeCharge[]> {
    const client = resolveClient(ctx);
    const rows = await client.feeCharge.findMany({
      where: { repaymentInstallmentId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  async findViewsByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<FeeChargeView[]> {
    const client = resolveClient(ctx);
    const rows = await client.feeCharge.findMany({
      where: { repaymentInstallment: { loanAccountId } },
      orderBy: { createdAt: 'asc' },
      include: {
        repaymentInstallment: { select: { installmentNumber: true, dueDate: true } },
        chargedBy: { select: { firstName: true, lastName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      repaymentInstallmentId: row.repaymentInstallmentId,
      installmentNumber: row.repaymentInstallment.installmentNumber,
      installmentDueDate: row.repaymentInstallment.dueDate,
      loanTransactionId: row.loanTransactionId,
      previousFeesAmount: Money.of(row.previousFeesAmount),
      newFeesAmount: Money.of(row.newFeesAmount),
      reason: row.reason,
      chargedByUserId: row.chargedByUserId,
      chargedByName: row.chargedBy ? `${row.chargedBy.firstName} ${row.chargedBy.lastName}`.trim() : null,
      createdAt: row.createdAt,
    }));
  }
}
