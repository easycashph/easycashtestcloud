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
    undoneAt: row.undoneAt ?? undefined,
    undoneByUserId: row.undoneByUserId ?? undefined,
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

  /**
   * 2026-08-07 (Undo Adjustment feature): `oldLoanAccountId` is no longer `@unique` (a loan can
   * accumulate more than one row over its lifetime - an undone one, then a fresh one), so this is
   * a `findFirst` now, scoped to `undoneAt: null` - only the currently-ACTIVE adjustment counts for
   * "already adjusted" purposes. An undone one is deliberately invisible here.
   */
  async findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAdjustment.findFirst({ where: { oldLoanAccountId: loanAccountId, undoneAt: null } });
    return row ? toDomain(row) : null;
  }

  async findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAdjustment.findUnique({ where: { newLoanAccountId: loanAccountId } });
    return row ? toDomain(row) : null;
  }

  /** 2026-08-07 (Undo Adjustment feature): the ONE exception to `create()`-only - persists `markUndone()`. */
  async update(adjustment: LoanAdjustment, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanAdjustment.update({
      where: { id: adjustment.id },
      data: { undoneAt: adjustment.undoneAt ?? null, undoneByUserId: adjustment.undoneByUserId ?? null },
    });
  }

  async findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustmentView | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAdjustment.findFirst({
      where: { OR: [{ oldLoanAccountId: loanAccountId }, { newLoanAccountId: loanAccountId }] },
      // 2026-08-07 (Undo Adjustment feature): the OLD side can now have more than one row - show
      // the most recent (whichever is currently relevant).
      orderBy: { createdAt: 'desc' },
      include: {
        oldLoanAccount: { select: { loanCode: true } },
        newLoanAccount: { select: { loanCode: true } },
        adjustedBy: { select: { firstName: true, lastName: true } },
        undoneBy: { select: { firstName: true, lastName: true } },
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
      undoneAt: row.undoneAt,
      undoneByName: row.undoneBy ? `${row.undoneBy.firstName} ${row.undoneBy.lastName}`.trim() : null,
    };
  }
}
