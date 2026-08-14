import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { PaymentAdjustment, type PaymentAdjustmentProps } from '../domain/PaymentAdjustment';
import type { IPaymentAdjustmentRepository } from '../application/ports/IPaymentAdjustmentRepository';

type PaymentAdjustmentRow = Prisma.PaymentAdjustmentGetPayload<Record<string, never>>;

function toDomain(row: PaymentAdjustmentRow): PaymentAdjustment {
  const props: PaymentAdjustmentProps = {
    id: row.id,
    loanTransactionId: row.loanTransactionId,
    repaymentInstallmentId: row.repaymentInstallmentId,
    previousPrincipalPaid: Money.of(row.previousPrincipalPaid),
    previousInterestPaid: Money.of(row.previousInterestPaid),
    previousFeesPaid: Money.of(row.previousFeesPaid),
    previousPenaltyPaid: Money.of(row.previousPenaltyPaid),
    newPrincipalPaid: Money.of(row.newPrincipalPaid),
    newInterestPaid: Money.of(row.newInterestPaid),
    newFeesPaid: Money.of(row.newFeesPaid),
    newPenaltyPaid: Money.of(row.newPenaltyPaid),
    reason: row.reason,
    adjustedByUserId: row.adjustedByUserId,
    createdAt: row.createdAt,
  };
  return PaymentAdjustment.reconstitute(props);
}

export class PrismaPaymentAdjustmentRepository implements IPaymentAdjustmentRepository {
  async createMany(adjustments: readonly PaymentAdjustment[], ctx?: TransactionContext): Promise<void> {
    if (adjustments.length === 0) return;
    const client = resolveClient(ctx);
    await client.paymentAdjustment.createMany({
      data: adjustments.map((a) => ({
        id: a.id,
        loanTransactionId: a.loanTransactionId,
        repaymentInstallmentId: a.repaymentInstallmentId,
        previousPrincipalPaid: a.previousPrincipalPaid.toDecimal(),
        previousInterestPaid: a.previousInterestPaid.toDecimal(),
        previousFeesPaid: a.previousFeesPaid.toDecimal(),
        previousPenaltyPaid: a.previousPenaltyPaid.toDecimal(),
        newPrincipalPaid: a.newPrincipalPaid.toDecimal(),
        newInterestPaid: a.newInterestPaid.toDecimal(),
        newFeesPaid: a.newFeesPaid.toDecimal(),
        newPenaltyPaid: a.newPenaltyPaid.toDecimal(),
        reason: a.reason,
        adjustedByUserId: a.adjustedByUserId,
        createdAt: a.createdAt,
      })),
    });
  }

  async findByLoanTransactionId(loanTransactionId: string, ctx?: TransactionContext): Promise<PaymentAdjustment[]> {
    const client = resolveClient(ctx);
    const rows = await client.paymentAdjustment.findMany({ where: { loanTransactionId } });
    return rows.map(toDomain);
  }
}
