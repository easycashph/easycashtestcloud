import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { LoanAdjustment, type LoanAdjustmentProps } from '../domain/LoanAdjustment';
import type { ILoanAdjustmentRepository, LoanAdjustmentView } from '../application/ports/ILoanAdjustmentRepository';

type LoanAdjustmentRow = Prisma.LoanAdjustmentGetPayload<Record<string, never>>;

function toDomain(row: LoanAdjustmentRow): LoanAdjustment {
  const props: LoanAdjustmentProps = {
    id: row.id,
    oldLoanAccountId: row.oldLoanAccountId,
    newLoanAccountId: row.newLoanAccountId,
    previousFirstRepaymentDate: row.previousFirstRepaymentDate,
    newFirstRepaymentDate: row.newFirstRepaymentDate,
    reason: row.reason ?? undefined,
    adjustedByUserId: row.adjustedByUserId,
    createdAt: row.createdAt,
  };
  return LoanAdjustment.reconstitute(props);
}

export class PrismaLoanAdjustmentRepository implements ILoanAdjustmentRepository {
  async create(adjustment: LoanAdjustment, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanAdjustment.create({
      data: {
        id: adjustment.id,
        oldLoanAccountId: adjustment.oldLoanAccountId,
        newLoanAccountId: adjustment.newLoanAccountId,
        previousFirstRepaymentDate: adjustment.previousFirstRepaymentDate,
        newFirstRepaymentDate: adjustment.newFirstRepaymentDate,
        reason: adjustment.reason,
        adjustedByUserId: adjustment.adjustedByUserId,
        createdAt: adjustment.createdAt,
      },
    });
  }

  async findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAdjustment.findFirst({ where: { oldLoanAccountId: loanAccountId } });
    return row ? toDomain(row) : null;
  }

  async findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAdjustment.findUnique({ where: { newLoanAccountId: loanAccountId } });
    return row ? toDomain(row) : null;
  }

  /** 2026-08-08 (Undo Adjustment feature, user-confirmed revision): deletes the row outright - see `ILoanAdjustmentRepository.delete()`. */
  async delete(loanAdjustmentId: string, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanAdjustment.delete({ where: { id: loanAdjustmentId } });
  }

  async findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustmentView | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAdjustment.findFirst({
      where: { OR: [{ oldLoanAccountId: loanAccountId }, { newLoanAccountId: loanAccountId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        oldLoanAccount: { select: { loanCode: true } },
        newLoanAccount: { select: { loanCode: true } },
        adjustedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      oldLoanAccountId: row.oldLoanAccountId,
      oldLoanCode: row.oldLoanAccount.loanCode,
      newLoanAccountId: row.newLoanAccountId,
      newLoanCode: row.newLoanAccount.loanCode,
      previousFirstRepaymentDate: row.previousFirstRepaymentDate,
      newFirstRepaymentDate: row.newFirstRepaymentDate,
      reason: row.reason,
      adjustedByUserId: row.adjustedByUserId,
      adjustedByName: row.adjustedBy ? `${row.adjustedBy.firstName} ${row.adjustedBy.lastName}`.trim() : null,
      createdAt: row.createdAt,
    };
  }
}
