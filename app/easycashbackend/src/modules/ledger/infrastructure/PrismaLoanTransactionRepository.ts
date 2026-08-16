import { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { LoanTransaction, type LoanTransactionProps } from '../domain/LoanTransaction';
import { TransactionComponents } from '../domain/valueObjects/TransactionComponents';
import type { FindByLoanAccountIdOptions, ILoanTransactionRepository } from '../application/ports/ILoanTransactionRepository';

type LoanTransactionRow = Prisma.LoanTransactionGetPayload<Record<string, never>>;

function toDomain(row: LoanTransactionRow): LoanTransaction {
  const props: LoanTransactionProps = {
    id: row.id,
    loanAccountId: row.loanAccountId,
    type: row.type,
    amount: Money.of(row.amount),
    components: TransactionComponents.of({
      principalComponent: Money.of(row.principalComponent),
      interestComponent: Money.of(row.interestComponent),
      feesComponent: Money.of(row.feesComponent),
      penaltyComponent: Money.of(row.penaltyComponent),
    }),
    balanceAfter: Money.of(row.balanceAfter),
    postedByUserId: row.postedByUserId ?? undefined,
    branchId: row.branchId,
    entryDate: row.entryDate,
    comment: row.comment ?? undefined,
    orNumber: row.orNumber ?? undefined,
    arNumber: row.arNumber ?? undefined,
    paymentMethod: row.paymentMethod ?? undefined,
    reversesTransactionId: row.reversesTransactionId ?? undefined,
    legacyId: row.legacyId ?? undefined,
    createdAt: row.createdAt,
  };
  return LoanTransaction.reconstitute(props);
}

/**
 * TXN-1: this class implements `ILoanTransactionRepository`, whose type
 * signature has no `update()` method — there is nothing here that could
 * accidentally mutate a posted transaction. `deleteAllByLoanAccountId` is a
 * narrow, deliberate exception — see the port's own doc comment.
 */
export class PrismaLoanTransactionRepository implements ILoanTransactionRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<LoanTransaction | null> {
    const client = resolveClient(ctx);
    const row = await client.loanTransaction.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByLoanAccountId(
    loanAccountId: string,
    options: FindByLoanAccountIdOptions,
    ctx?: TransactionContext,
  ): Promise<LoanTransaction[]> {
    const client = resolveClient(ctx);

    // Ordering by raw entryDate (even with the createdAt tiebreaker) still put same-day
    // REVERSAL/DISBURSEMENT transactions above same-day REPAYMENTs, because REPAYMENT's entryDate
    // is date-only (midnight, from the "Payment date" picker — see this repository's own history)
    // while REVERSAL (`reversedAt`, defaults to `new Date()`) and DISBURSEMENT (`activatedAt`)
    // carry a real time-of-day that always compares as "later" than midnight on the same calendar
    // day. Truncating entryDate to the calendar day for the primary sort key (raw SQL — Prisma's
    // orderBy has no DATE() truncation) makes same-day transactions tie there, so createdAt (the
    // one universally reliable "when this was actually recorded" timestamp) decides the order
    // within a day, while entryDate still governs cross-day ordering (a backdated transaction
    // still sits near its stated date, not at the top of the list).
    const branchClause = options.branchId ? Prisma.sql`AND lt."branchId" = ${options.branchId}` : Prisma.empty;
    const typeClause = options.type ? Prisma.sql`AND lt."type" = ${options.type}` : Prisma.empty;
    const cursorClause = options.cursor
      ? Prisma.sql`AND (DATE(lt."entryDate"), lt."createdAt", lt.id) < (
          SELECT DATE(c."entryDate"), c."createdAt", c.id FROM loan_transactions c WHERE c.id = ${options.cursor}
        )`
      : Prisma.empty;

    const orderedIds = await client.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT lt.id
      FROM loan_transactions lt
      WHERE lt."loanAccountId" = ${loanAccountId}
      ${branchClause}
      ${typeClause}
      ${cursorClause}
      ORDER BY DATE(lt."entryDate") DESC, lt."createdAt" DESC, lt.id DESC
      LIMIT ${options.limit}
    `);

    if (orderedIds.length === 0) return [];

    const rows = await client.loanTransaction.findMany({ where: { id: { in: orderedIds.map((r) => r.id) } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return orderedIds.map((r) => toDomain(byId.get(r.id)!));
  }

  async findByReversesTransactionId(transactionId: string, ctx?: TransactionContext): Promise<LoanTransaction | null> {
    const client = resolveClient(ctx);
    const row = await client.loanTransaction.findUnique({ where: { reversesTransactionId: transactionId } });
    return row ? toDomain(row) : null;
  }

  async findPossibleMigratedDuplicate(
    loanAccountId: string,
    amount: Money,
    entryDayStart: Date,
    entryDayEnd: Date,
    ctx?: TransactionContext,
  ): Promise<LoanTransaction | null> {
    const client = resolveClient(ctx);
    const row = await client.loanTransaction.findFirst({
      where: {
        loanAccountId,
        type: 'REPAYMENT',
        legacyId: { not: null },
        amount: amount.toDecimal(),
        entryDate: { gte: entryDayStart, lt: entryDayEnd },
      },
    });
    return row ? toDomain(row) : null;
  }

  async create(transaction: LoanTransaction, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanTransaction.create({
      data: {
        id: transaction.id,
        loanAccountId: transaction.loanAccountId,
        type: transaction.type,
        amount: transaction.amount.toDecimal(),
        principalComponent: transaction.components.principalComponent.toDecimal(),
        interestComponent: transaction.components.interestComponent.toDecimal(),
        feesComponent: transaction.components.feesComponent.toDecimal(),
        penaltyComponent: transaction.components.penaltyComponent.toDecimal(),
        balanceAfter: transaction.balanceAfter.toDecimal(),
        postedByUserId: transaction.postedByUserId,
        branchId: transaction.branchId,
        entryDate: transaction.entryDate,
        comment: transaction.comment,
        orNumber: transaction.orNumber,
        arNumber: transaction.arNumber,
        paymentMethod: transaction.paymentMethod,
        reversesTransactionId: transaction.reversesTransactionId,
        legacyId: transaction.legacyId,
        createdAt: transaction.createdAt,
      },
    });
  }

  async deleteAllByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanTransaction.deleteMany({ where: { loanAccountId } });
  }
}
