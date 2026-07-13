import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { PaymentAllocation, type PaymentAllocationProps } from '../domain/PaymentAllocation';
import type { IPaymentAllocationRepository } from '../application/ports/IPaymentAllocationRepository';

type PaymentAllocationRow = Prisma.PaymentAllocationGetPayload<Record<string, never>>;

function toDomain(row: PaymentAllocationRow): PaymentAllocation {
  const props: PaymentAllocationProps = {
    id: row.id,
    loanTransactionId: row.loanTransactionId,
    repaymentInstallmentId: row.repaymentInstallmentId,
    principalApplied: Money.of(row.principalApplied),
    interestApplied: Money.of(row.interestApplied),
    feesApplied: Money.of(row.feesApplied),
    penaltyApplied: Money.of(row.penaltyApplied),
    createdAt: row.createdAt,
  };
  return PaymentAllocation.reconstitute(props);
}

export class PrismaPaymentAllocationRepository implements IPaymentAllocationRepository {
  async createMany(allocations: readonly PaymentAllocation[], ctx?: TransactionContext): Promise<void> {
    if (allocations.length === 0) return;
    const client = resolveClient(ctx);
    await client.paymentAllocation.createMany({
      data: allocations.map((a) => ({
        id: a.id,
        loanTransactionId: a.loanTransactionId,
        repaymentInstallmentId: a.repaymentInstallmentId,
        principalApplied: a.principalApplied.toDecimal(),
        interestApplied: a.interestApplied.toDecimal(),
        feesApplied: a.feesApplied.toDecimal(),
        penaltyApplied: a.penaltyApplied.toDecimal(),
        createdAt: a.createdAt,
      })),
    });
  }

  async findByLoanTransactionId(loanTransactionId: string, ctx?: TransactionContext): Promise<PaymentAllocation[]> {
    const client = resolveClient(ctx);
    const rows = await client.paymentAllocation.findMany({ where: { loanTransactionId } });
    return rows.map(toDomain);
  }
}
