import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { LoanRestructure, type LoanRestructureProps } from '../domain/LoanRestructure';
import type { ILoanRestructureRepository, LoanRestructureView } from '../application/ports/ILoanRestructureRepository';

type LoanRestructureRow = Prisma.LoanRestructureGetPayload<Record<string, never>>;

function toDomain(row: LoanRestructureRow): LoanRestructure {
  const props: LoanRestructureProps = {
    id: row.id,
    oldLoanAccountId: row.oldLoanAccountId,
    newLoanAccountId: row.newLoanAccountId,
    previousCollectionsBalance: Money.of(row.previousCollectionsBalance),
    newPrincipalAmount: Money.of(row.newPrincipalAmount),
    reason: row.reason ?? undefined,
    restructuredByUserId: row.restructuredByUserId,
    createdAt: row.createdAt,
    undoneAt: row.undoneAt ?? undefined,
    undoneByUserId: row.undoneByUserId ?? undefined,
  };
  return LoanRestructure.reconstitute(props);
}

export class PrismaLoanRestructureRepository implements ILoanRestructureRepository {
  async create(restructure: LoanRestructure, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanRestructure.create({
      data: {
        id: restructure.id,
        oldLoanAccountId: restructure.oldLoanAccountId,
        newLoanAccountId: restructure.newLoanAccountId,
        previousCollectionsBalance: restructure.previousCollectionsBalance.toDecimal(),
        newPrincipalAmount: restructure.newPrincipalAmount.toDecimal(),
        reason: restructure.reason,
        restructuredByUserId: restructure.restructuredByUserId,
        createdAt: restructure.createdAt,
      },
    });
  }

  /**
   * 2026-08-07 (Undo Restructure feature): `oldLoanAccountId` is no longer `@unique` (a loan can
   * accumulate more than one row over its lifetime - an undone one, then a fresh one), so this is
   * a `findFirst` now, scoped to `undoneAt: null` - only the currently-ACTIVE restructure counts
   * for "already restructured" purposes. An undone one is deliberately invisible here.
   */
  async findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructure | null> {
    const client = resolveClient(ctx);
    const row = await client.loanRestructure.findFirst({ where: { oldLoanAccountId: loanAccountId, undoneAt: null } });
    return row ? toDomain(row) : null;
  }

  async findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructure | null> {
    const client = resolveClient(ctx);
    const row = await client.loanRestructure.findUnique({ where: { newLoanAccountId: loanAccountId } });
    return row ? toDomain(row) : null;
  }

  /** 2026-08-07 (Undo Restructure feature): the ONE exception to `create()`-only - persists `markUndone()`. */
  async update(restructure: LoanRestructure, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanRestructure.update({
      where: { id: restructure.id },
      data: { undoneAt: restructure.undoneAt ?? null, undoneByUserId: restructure.undoneByUserId ?? null },
    });
  }

  async findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructureView | null> {
    const client = resolveClient(ctx);
    const row = await client.loanRestructure.findFirst({
      where: { OR: [{ oldLoanAccountId: loanAccountId }, { newLoanAccountId: loanAccountId }] },
      // 2026-08-07 (Undo Restructure feature): the OLD side can now have more than one row - show
      // the most recent (whichever is currently relevant: the active one, or the undone one if
      // nothing has happened since).
      orderBy: { createdAt: 'desc' },
      include: {
        oldLoanAccount: { select: { loanCode: true } },
        newLoanAccount: { select: { loanCode: true } },
        restructuredBy: { select: { firstName: true, lastName: true } },
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
      previousCollectionsBalance: Money.of(row.previousCollectionsBalance),
      newPrincipalAmount: Money.of(row.newPrincipalAmount),
      reason: row.reason,
      restructuredByUserId: row.restructuredByUserId,
      restructuredByName: row.restructuredBy ? `${row.restructuredBy.firstName} ${row.restructuredBy.lastName}`.trim() : null,
      createdAt: row.createdAt,
      undoneAt: row.undoneAt,
      undoneByName: row.undoneBy ? `${row.undoneBy.firstName} ${row.undoneBy.lastName}`.trim() : null,
    };
  }
}
