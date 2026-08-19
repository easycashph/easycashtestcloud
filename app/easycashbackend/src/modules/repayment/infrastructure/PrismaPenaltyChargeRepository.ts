import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { PenaltyCharge, type PenaltyChargeProps } from '../domain/PenaltyCharge';
import type { IPenaltyChargeRepository, PenaltyChargeView } from '../application/ports/IPenaltyChargeRepository';

type PenaltyChargeRow = Prisma.PenaltyChargeGetPayload<Record<string, never>>;

function toDomain(row: PenaltyChargeRow): PenaltyCharge {
  const props: PenaltyChargeProps = {
    id: row.id,
    repaymentInstallmentId: row.repaymentInstallmentId,
    loanTransactionId: row.loanTransactionId,
    previousPenaltyAmount: Money.of(row.previousPenaltyAmount),
    newPenaltyAmount: Money.of(row.newPenaltyAmount),
    reason: row.reason,
    chargedByUserId: row.chargedByUserId,
    createdAt: row.createdAt,
  };
  return PenaltyCharge.reconstitute(props);
}

export class PrismaPenaltyChargeRepository implements IPenaltyChargeRepository {
  async create(charge: PenaltyCharge, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.penaltyCharge.create({
      data: {
        id: charge.id,
        repaymentInstallmentId: charge.repaymentInstallmentId,
        loanTransactionId: charge.loanTransactionId,
        previousPenaltyAmount: charge.previousPenaltyAmount.toDecimal(),
        newPenaltyAmount: charge.newPenaltyAmount.toDecimal(),
        reason: charge.reason,
        chargedByUserId: charge.chargedByUserId,
        createdAt: charge.createdAt,
      },
    });
  }

  async findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<PenaltyCharge[]> {
    const client = resolveClient(ctx);
    const rows = await client.penaltyCharge.findMany({
      where: { repaymentInstallmentId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  async findViewsByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<PenaltyChargeView[]> {
    const client = resolveClient(ctx);
    const rows = await client.penaltyCharge.findMany({
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
      previousPenaltyAmount: Money.of(row.previousPenaltyAmount),
      newPenaltyAmount: Money.of(row.newPenaltyAmount),
      reason: row.reason,
      chargedByUserId: row.chargedByUserId,
      chargedByName: row.chargedBy ? `${row.chargedBy.firstName} ${row.chargedBy.lastName}`.trim() : null,
      createdAt: row.createdAt,
    }));
  }
}
