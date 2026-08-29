import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { LoanCompromiseSettlement, type LoanCompromiseSettlementProps } from '../domain/LoanCompromiseSettlement';
import type {
  ILoanCompromiseSettlementRepository,
  LoanCompromiseSettlementView,
} from '../application/ports/ILoanCompromiseSettlementRepository';

type LoanCompromiseSettlementRow = Prisma.LoanCompromiseSettlementGetPayload<{ include: { items: true } }>;

function toDomain(row: LoanCompromiseSettlementRow): LoanCompromiseSettlement {
  const props: LoanCompromiseSettlementProps = {
    id: row.id,
    newLoanAccountId: row.newLoanAccountId,
    totalPreviousBalance: Money.of(row.totalPreviousBalance),
    settlementAmount: Money.of(row.settlementAmount),
    reason: row.reason ?? undefined,
    settledByUserId: row.settledByUserId,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      oldLoanAccountId: item.oldLoanAccountId,
      previousCollectionsBalance: Money.of(item.previousCollectionsBalance),
    })),
  };
  return LoanCompromiseSettlement.reconstitute(props);
}

export class PrismaLoanCompromiseSettlementRepository implements ILoanCompromiseSettlementRepository {
  async create(settlement: LoanCompromiseSettlement, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanCompromiseSettlement.create({
      data: {
        id: settlement.id,
        newLoanAccountId: settlement.newLoanAccountId,
        totalPreviousBalance: settlement.totalPreviousBalance.toDecimal(),
        settlementAmount: settlement.settlementAmount.toDecimal(),
        reason: settlement.reason,
        settledByUserId: settlement.settledByUserId,
        createdAt: settlement.createdAt,
        items: {
          create: settlement.items.map((item) => ({
            id: item.id,
            oldLoanAccountId: item.oldLoanAccountId,
            previousCollectionsBalance: item.previousCollectionsBalance.toDecimal(),
          })),
        },
      },
    });
  }

  async findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanCompromiseSettlement | null> {
    const client = resolveClient(ctx);
    const item = await client.loanCompromiseSettlementItem.findUnique({
      where: { oldLoanAccountId: loanAccountId },
      include: { settlement: { include: { items: true } } },
    });
    return item ? toDomain(item.settlement) : null;
  }

  async findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanCompromiseSettlement | null> {
    const client = resolveClient(ctx);
    const row = await client.loanCompromiseSettlement.findUnique({
      where: { newLoanAccountId: loanAccountId },
      include: { items: true },
    });
    return row ? toDomain(row) : null;
  }

  async findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanCompromiseSettlementView | null> {
    const client = resolveClient(ctx);
    const row = await client.loanCompromiseSettlement.findFirst({
      where: { OR: [{ newLoanAccountId: loanAccountId }, { items: { some: { oldLoanAccountId: loanAccountId } } }] },
      orderBy: { createdAt: 'desc' },
      include: {
        newLoanAccount: { select: { loanCode: true } },
        settledBy: { select: { firstName: true, lastName: true } },
        items: { include: { oldLoanAccount: { select: { loanCode: true } } } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      newLoanAccountId: row.newLoanAccountId,
      newLoanCode: row.newLoanAccount.loanCode,
      totalPreviousBalance: Money.of(row.totalPreviousBalance),
      settlementAmount: Money.of(row.settlementAmount),
      reason: row.reason,
      settledByUserId: row.settledByUserId,
      settledByName: row.settledBy ? `${row.settledBy.firstName} ${row.settledBy.lastName}`.trim() : null,
      createdAt: row.createdAt,
      items: row.items.map((item) => ({
        id: item.id,
        oldLoanAccountId: item.oldLoanAccountId,
        oldLoanCode: item.oldLoanAccount.loanCode,
        previousCollectionsBalance: Money.of(item.previousCollectionsBalance),
      })),
    };
  }
}
