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

  async findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructure | null> {
    const client = resolveClient(ctx);
    const row = await client.loanRestructure.findUnique({ where: { oldLoanAccountId: loanAccountId } });
    return row ? toDomain(row) : null;
  }

  async findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructure | null> {
    const client = resolveClient(ctx);
    const row = await client.loanRestructure.findUnique({ where: { newLoanAccountId: loanAccountId } });
    return row ? toDomain(row) : null;
  }

  async findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructureView | null> {
    const client = resolveClient(ctx);
    const row = await client.loanRestructure.findFirst({
      where: { OR: [{ oldLoanAccountId: loanAccountId }, { newLoanAccountId: loanAccountId }] },
      include: {
        oldLoanAccount: { select: { loanCode: true } },
        newLoanAccount: { select: { loanCode: true } },
        restructuredBy: { select: { firstName: true, lastName: true } },
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
    };
  }
}
