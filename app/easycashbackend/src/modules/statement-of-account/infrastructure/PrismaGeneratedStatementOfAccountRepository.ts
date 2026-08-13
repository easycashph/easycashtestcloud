import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Money } from '@shared/domain/Money';
import { GeneratedStatementOfAccount, type GeneratedStatementOfAccountProps } from '../domain/GeneratedStatementOfAccount';
import { formatSoaNumber } from '../domain/formatSoaNumber';
import type {
  IGeneratedStatementOfAccountRepository,
  GeneratedStatementOfAccountView,
} from '../application/ports/IGeneratedStatementOfAccountRepository';

type Row = Prisma.GeneratedStatementOfAccountGetPayload<Record<string, never>>;

function toDomain(row: Row): GeneratedStatementOfAccount {
  const props: GeneratedStatementOfAccountProps = {
    id: row.id,
    loanAccountId: row.loanAccountId,
    soaSequenceNumber: row.soaSequenceNumber,
    penaltyMode: row.penaltyMode,
    penaltyFromDate: row.penaltyFromDate,
    penaltyToDate: row.penaltyToDate,
    penaltyManualReason: row.penaltyManualReason,
    accruedInterestAsOfDate: row.accruedInterestAsOfDate,
    currentAmortizationDue: Money.of(row.currentAmortizationDue),
    pastDuePrincipal: Money.of(row.pastDuePrincipal),
    pastDueInterest: Money.of(row.pastDueInterest),
    pastDuePenalty: Money.of(row.pastDuePenalty),
    totalPastDue: Money.of(row.totalPastDue),
    accruedInterest: Money.of(row.accruedInterest),
    collectionFee: Money.of(row.collectionFee),
    otherFee: Money.of(row.otherFee),
    totalAmountDue: Money.of(row.totalAmountDue),
    storageKey: row.storageKey,
    generatedByUserId: row.generatedByUserId,
    generatedAt: row.generatedAt,
  };
  return GeneratedStatementOfAccount.reconstitute(props);
}

export class PrismaGeneratedStatementOfAccountRepository implements IGeneratedStatementOfAccountRepository {
  async create(statement: GeneratedStatementOfAccount, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.generatedStatementOfAccount.create({
      data: {
        id: statement.id,
        loanAccountId: statement.loanAccountId,
        soaSequenceNumber: statement.soaSequenceNumber,
        penaltyMode: statement.penaltyMode,
        penaltyFromDate: statement.penaltyFromDate,
        penaltyToDate: statement.penaltyToDate,
        penaltyManualReason: statement.penaltyManualReason,
        accruedInterestAsOfDate: statement.accruedInterestAsOfDate,
        currentAmortizationDue: statement.currentAmortizationDue.toDecimal(),
        pastDuePrincipal: statement.pastDuePrincipal.toDecimal(),
        pastDueInterest: statement.pastDueInterest.toDecimal(),
        pastDuePenalty: statement.pastDuePenalty.toDecimal(),
        totalPastDue: statement.totalPastDue.toDecimal(),
        accruedInterest: statement.accruedInterest.toDecimal(),
        collectionFee: statement.collectionFee.toDecimal(),
        otherFee: statement.otherFee.toDecimal(),
        totalAmountDue: statement.totalAmountDue.toDecimal(),
        storageKey: statement.storageKey,
        generatedByUserId: statement.generatedByUserId,
        generatedAt: statement.generatedAt,
      },
    });
  }

  async findById(id: string, ctx?: TransactionContext): Promise<GeneratedStatementOfAccount | null> {
    const client = resolveClient(ctx);
    const row = await client.generatedStatementOfAccount.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAllForLoanAccount(loanAccountId: string, ctx?: TransactionContext): Promise<GeneratedStatementOfAccountView[]> {
    const client = resolveClient(ctx);
    const rows = await client.generatedStatementOfAccount.findMany({
      where: { loanAccountId },
      orderBy: { generatedAt: 'desc' },
      include: { generatedBy: { select: { firstName: true, lastName: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      loanAccountId: row.loanAccountId,
      soaNumber: formatSoaNumber(row.soaSequenceNumber, row.generatedAt),
      penaltyMode: row.penaltyMode,
      penaltyFromDate: row.penaltyFromDate,
      penaltyToDate: row.penaltyToDate,
      penaltyManualReason: row.penaltyManualReason,
      accruedInterestAsOfDate: row.accruedInterestAsOfDate,
      pastDuePenalty: Money.of(row.pastDuePenalty).toString(),
      accruedInterest: Money.of(row.accruedInterest).toString(),
      totalAmountDue: Money.of(row.totalAmountDue).toString(),
      generatedByUserId: row.generatedByUserId,
      generatedByName: `${row.generatedBy.firstName} ${row.generatedBy.lastName}`.trim(),
      generatedAt: row.generatedAt,
    }));
  }

  /** PER-LOAN-ACCOUNT running counter — see `soaSequenceNumber`'s own doc comment in schema.prisma for why this is a plain "max + 1" read rather than a native DB sequence. */
  async findMaxSoaSequenceNumber(loanAccountId: string, ctx?: TransactionContext): Promise<number> {
    const client = resolveClient(ctx);
    const result = await client.generatedStatementOfAccount.aggregate({
      where: { loanAccountId },
      _max: { soaSequenceNumber: true },
    });
    return result._max.soaSequenceNumber ?? 0;
  }
}
