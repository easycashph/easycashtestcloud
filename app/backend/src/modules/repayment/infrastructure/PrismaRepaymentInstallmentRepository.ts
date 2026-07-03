import type { Prisma } from '@prisma/client';
import { resolveClient, withTransaction } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { RepaymentInstallment, type RepaymentInstallmentProps } from '../domain/RepaymentInstallment';
import { InstallmentAmounts } from '../domain/valueObjects/InstallmentAmounts';
import type { IRepaymentInstallmentRepository } from '../application/ports/IRepaymentInstallmentRepository';

type RepaymentScheduleRow = Prisma.RepaymentScheduleGetPayload<Record<string, never>>;

function toDomain(row: RepaymentScheduleRow): RepaymentInstallment {
  const props: RepaymentInstallmentProps = {
    id: row.id,
    loanAccountId: row.loanAccountId,
    installmentNumber: row.installmentNumber,
    dueDate: row.dueDate,
    due: InstallmentAmounts.of({
      principal: Money.of(row.principalDue),
      interest: Money.of(row.interestDue),
      fees: Money.of(row.feesDue),
      penalty: Money.of(row.penaltyDue),
    }),
    paid: InstallmentAmounts.of({
      principal: Money.of(row.principalPaid),
      interest: Money.of(row.interestPaid),
      fees: Money.of(row.feesPaid),
      penalty: Money.of(row.penaltyPaid),
    }),
    lastPaidAt: row.lastPaidAt ?? undefined,
    legacyId: row.legacyId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
  return RepaymentInstallment.reconstitute(props);
}

/**
 * The schema persists a `status` column (RepaymentScheduleRow.status) even
 * though the domain entity treats status as always-derived (REPAY-3) —
 * that column is a queryable cache of `RepaymentInstallment.status`,
 * written on every save so it can never diverge from the derivation, never
 * read back into the domain entity's own state.
 */
function toUpsertData(installment: RepaymentInstallment) {
  return {
    loanAccountId: installment.loanAccountId,
    installmentNumber: installment.installmentNumber,
    dueDate: installment.dueDate,
    principalDue: installment.due.principal.toDecimal(),
    interestDue: installment.due.interest.toDecimal(),
    feesDue: installment.due.fees.toDecimal(),
    penaltyDue: installment.due.penalty.toDecimal(),
    principalPaid: installment.paid.principal.toDecimal(),
    interestPaid: installment.paid.interest.toDecimal(),
    feesPaid: installment.paid.fees.toDecimal(),
    penaltyPaid: installment.paid.penalty.toDecimal(),
    status: installment.status,
    lastPaidAt: installment.lastPaidAt,
    legacyId: installment.legacyId,
    createdAt: installment.createdAt,
    updatedAt: installment.updatedAt,
  };
}

export class PrismaRepaymentInstallmentRepository implements IRepaymentInstallmentRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<RepaymentInstallment | null> {
    const client = resolveClient(ctx);
    const row = await client.repaymentSchedule.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<RepaymentInstallment[]> {
    const client = resolveClient(ctx);
    const rows = await client.repaymentSchedule.findMany({
      where: { loanAccountId },
      orderBy: { installmentNumber: 'asc' },
    });
    return rows.map(toDomain);
  }

  async save(installment: RepaymentInstallment, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.repaymentSchedule.upsert({
      where: { id: installment.id },
      create: { id: installment.id, ...toUpsertData(installment) },
      update: toUpsertData(installment),
    });
  }

  /**
   * Audit finding C-2 (Milestone 7.1 remediation): a full schedule batch
   * must commit atomically — ADR-042 §7 relies on "a single batch write"
   * as the reason RepaymentInstallment doesn't need a shared
   * RepaymentSchedule aggregate to protect the sum-of-due-amounts
   * invariant. `withTransaction` delivers that guarantee when no outer
   * `ctx` is supplied, and joins the caller's transaction (rather than
   * nesting one) when one is.
   */
  async saveMany(installments: RepaymentInstallment[], ctx?: TransactionContext): Promise<void> {
    await withTransaction(ctx, async (client) => {
      for (const installment of installments) {
        await client.repaymentSchedule.upsert({
          where: { id: installment.id },
          create: { id: installment.id, ...toUpsertData(installment) },
          update: toUpsertData(installment),
        });
      }
    });
  }
}
