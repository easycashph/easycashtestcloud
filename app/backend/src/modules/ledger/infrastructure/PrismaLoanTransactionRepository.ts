import type { Prisma } from '@prisma/client';
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
    reversesTransactionId: row.reversesTransactionId ?? undefined,
    legacyId: row.legacyId ?? undefined,
    createdAt: row.createdAt,
  };
  return LoanTransaction.reconstitute(props);
}

/**
 * TXN-1: this class implements `ILoanTransactionRepository`, whose type
 * signature has no `update()`/`delete()` method — there is nothing here
 * that could accidentally mutate a posted transaction.
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
    const rows = await client.loanTransaction.findMany({
      where: options.branchId ? { loanAccountId, branchId: options.branchId } : { loanAccountId },
      orderBy: { entryDate: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomain);
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
        reversesTransactionId: transaction.reversesTransactionId,
        legacyId: transaction.legacyId,
        createdAt: transaction.createdAt,
      },
    });
  }
}
