import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { ConcurrencyConflictError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { LoanAccount, type LoanAccountProps } from '../domain/LoanAccount';
import { LoanBalances } from '../domain/valueObjects/LoanBalances';
import { OriginationFees } from '../domain/valueObjects/OriginationFees';
import { AppliedFee } from '../domain/AppliedFee';
import type { FindManyLoanAccountsOptions, ILoanAccountRepository } from '../application/ports/ILoanAccountRepository';

const LOAN_ACCOUNT_INCLUDE = {
  appliedFees: true,
  coBorrowers: true,
} satisfies Prisma.LoanAccountInclude;

type LoanAccountRow = Prisma.LoanAccountGetPayload<{ include: typeof LOAN_ACCOUNT_INCLUDE }>;
type PrismaWriteClient = PrismaClient | Prisma.TransactionClient;

function toDomain(row: LoanAccountRow): LoanAccount {
  const props: LoanAccountProps = {
    id: row.id,
    loanCode: row.loanCode,
    borrowerId: row.borrowerId,
    loanProductVersionId: row.loanProductVersionId,
    branchId: row.branchId,
    loanOfficerId: row.loanOfficerId ?? undefined,
    status: row.status,
    principalAmount: Money.of(row.principalAmount),
    balances: LoanBalances.of({
      principalBalance: Money.of(row.principalBalance),
      principalPaid: Money.of(row.principalPaid),
      principalDue: Money.of(row.principalDue),
      interestBalance: Money.of(row.interestBalance),
      interestPaid: Money.of(row.interestPaid),
      interestDue: Money.of(row.interestDue),
      feesBalance: Money.of(row.feesBalance),
      feesPaid: Money.of(row.feesPaid),
      feesDue: Money.of(row.feesDue),
      penaltyBalance: Money.of(row.penaltyBalance),
      penaltyPaid: Money.of(row.penaltyPaid),
      penaltyDue: Money.of(row.penaltyDue),
    }),
    interestRate: Percentage.of(row.interestRate),
    addOnInterestRate: row.addOnInterestRate ? Percentage.of(row.addOnInterestRate) : undefined,
    contractualInterestRate: row.contractualInterestRate ? Percentage.of(row.contractualInterestRate) : undefined,
    installmentCount: row.installmentCount,
    repaymentPeriodUnit: row.repaymentPeriodUnit,
    gracePeriodDays: row.gracePeriodDays,
    firstRepaymentDate: row.firstRepaymentDate,
    anticipatedDisbursementDate: row.anticipatedDisbursementDate ?? undefined,
    approvedAt: row.approvedAt ?? undefined,
    approvedByUserId: row.approvedByUserId ?? undefined,
    activatedAt: row.activatedAt ?? undefined,
    closedAt: row.closedAt ?? undefined,
    closedReason: row.closedReason ?? undefined,
    legacyBalanceDataMissing: row.legacyBalanceDataMissing,
    originationFees: OriginationFees.of({
      processingFee: Money.of(row.processingFee),
      advanceInterestFee: Money.of(row.advanceInterestFee),
      outstandingBalancePayoff: Money.of(row.outstandingBalancePayoff),
      docStampFee: Money.of(row.docStampFee),
      accountManagementFee: Money.of(row.accountManagementFee),
      otherFees: Money.of(row.otherFees),
      notarialFee: Money.of(row.notarialFee),
      webFee: Money.of(row.webFee),
      insuranceFee: Money.of(row.insuranceFee),
    }),
    netProceeds: Money.of(row.netProceeds),
    legacyId: row.legacyId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    appliedFees: row.appliedFees.map((feeRow) =>
      AppliedFee.reconstitute({
        id: feeRow.id,
        feeRuleId: feeRow.feeRuleId,
        amount: Money.of(feeRow.amount),
        taxAmount: Money.of(feeRow.taxAmount),
        appliedAt: feeRow.appliedAt,
        transactionId: feeRow.transactionId ?? undefined,
      }),
    ),
    coBorrowerIds: row.coBorrowers.map((join) => join.coBorrowerId),
    version: row.version,
  };
  return LoanAccount.reconstitute(props);
}

/**
 * Milestone 9.1 checkpoint 6 / `docs/Architecture/ADR-optimistic-
 * concurrency.md`: the aggregate's own `loanAccount` row is written via an
 * explicit INSERT (never-yet-persisted aggregates, `loanAccount.isNew`)
 * or a conditional `UPDATE ... WHERE id = ? AND version = ?` (existing
 * aggregates) — no unconditional `upsert()` — so that a write against a
 * stale in-memory version can never silently clobber a concurrent writer's
 * changes. A zero-row conditional update means another writer already
 * moved `version` forward since this aggregate was loaded; that raises
 * `ConcurrencyConflictError` (409) rather than proceeding.
 */
async function writeGraph(client: PrismaWriteClient, loanAccount: LoanAccount): Promise<void> {
  const balances = loanAccount.balances.toProps();
  const originationFees = loanAccount.originationFees.toProps();

  if (loanAccount.isNew) {
    await client.loanAccount.create({
      data: {
        id: loanAccount.id,
        loanCode: loanAccount.loanCode,
        borrowerId: loanAccount.borrowerId,
        loanProductVersionId: loanAccount.loanProductVersionId,
        branchId: loanAccount.branchId,
        loanOfficerId: loanAccount.loanOfficerId,
        status: loanAccount.status,
        principalAmount: loanAccount.principalAmount.toDecimal(),
        principalBalance: balances.principalBalance.toDecimal(),
        principalPaid: balances.principalPaid.toDecimal(),
        principalDue: balances.principalDue.toDecimal(),
        interestRate: loanAccount.interestRate.toDecimal(),
        addOnInterestRate: loanAccount.addOnInterestRate?.toDecimal(),
        contractualInterestRate: loanAccount.contractualInterestRate?.toDecimal(),
        interestBalance: balances.interestBalance.toDecimal(),
        interestPaid: balances.interestPaid.toDecimal(),
        interestDue: balances.interestDue.toDecimal(),
        feesBalance: balances.feesBalance.toDecimal(),
        feesPaid: balances.feesPaid.toDecimal(),
        feesDue: balances.feesDue.toDecimal(),
        penaltyBalance: balances.penaltyBalance.toDecimal(),
        penaltyPaid: balances.penaltyPaid.toDecimal(),
        penaltyDue: balances.penaltyDue.toDecimal(),
        installmentCount: loanAccount.installmentCount,
        repaymentPeriodUnit: loanAccount.repaymentPeriodUnit,
        gracePeriodDays: loanAccount.gracePeriodDays,
        firstRepaymentDate: loanAccount.firstRepaymentDate,
        anticipatedDisbursementDate: loanAccount.anticipatedDisbursementDate,
        approvedAt: loanAccount.approvedAt,
        approvedByUserId: loanAccount.approvedByUserId,
        activatedAt: loanAccount.activatedAt,
        closedAt: loanAccount.closedAt,
        closedReason: loanAccount.closedReason,
        processingFee: originationFees.processingFee.toDecimal(),
        advanceInterestFee: originationFees.advanceInterestFee.toDecimal(),
        outstandingBalancePayoff: originationFees.outstandingBalancePayoff.toDecimal(),
        docStampFee: originationFees.docStampFee.toDecimal(),
        accountManagementFee: originationFees.accountManagementFee.toDecimal(),
        otherFees: originationFees.otherFees.toDecimal(),
        notarialFee: originationFees.notarialFee.toDecimal(),
        webFee: originationFees.webFee.toDecimal(),
        insuranceFee: originationFees.insuranceFee.toDecimal(),
        netProceeds: loanAccount.netProceeds.toDecimal(),
        legacyId: loanAccount.legacyId,
        createdAt: loanAccount.createdAt,
        updatedAt: loanAccount.updatedAt,
        version: 0,
      },
    });
  } else {
    const result = await client.loanAccount.updateMany({
      where: { id: loanAccount.id, version: loanAccount.version },
      data: {
        loanOfficerId: loanAccount.loanOfficerId,
        status: loanAccount.status,
        principalBalance: balances.principalBalance.toDecimal(),
        principalPaid: balances.principalPaid.toDecimal(),
        principalDue: balances.principalDue.toDecimal(),
        interestBalance: balances.interestBalance.toDecimal(),
        interestPaid: balances.interestPaid.toDecimal(),
        interestDue: balances.interestDue.toDecimal(),
        feesBalance: balances.feesBalance.toDecimal(),
        feesPaid: balances.feesPaid.toDecimal(),
        feesDue: balances.feesDue.toDecimal(),
        penaltyBalance: balances.penaltyBalance.toDecimal(),
        penaltyPaid: balances.penaltyPaid.toDecimal(),
        penaltyDue: balances.penaltyDue.toDecimal(),
        approvedAt: loanAccount.approvedAt,
        approvedByUserId: loanAccount.approvedByUserId,
        activatedAt: loanAccount.activatedAt,
        closedAt: loanAccount.closedAt,
        closedReason: loanAccount.closedReason,
        updatedAt: loanAccount.updatedAt,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConcurrencyConflictError('LoanAccount', loanAccount.id);
    }
  }

  // FEE-4: AppliedFee is immutable once applied — upsert-by-id, never
  // deleted (a small, bounded collection per ADR-042 §5).
  for (const fee of loanAccount.appliedFees) {
    await client.appliedFee.upsert({
      where: { id: fee.id },
      create: {
        id: fee.id,
        loanAccountId: loanAccount.id,
        feeRuleId: fee.feeRuleId,
        amount: fee.amount.toDecimal(),
        taxAmount: fee.taxAmount.toDecimal(),
        appliedAt: fee.appliedAt,
        transactionId: fee.transactionId,
      },
      update: { transactionId: fee.transactionId },
    });
  }

  // LoanAccountCoBorrower join — replaced wholesale, mirroring the
  // Address-collection approach in the borrower module (ADR-042 §5: a
  // small, bounded collection).
  await client.loanAccountCoBorrower.deleteMany({ where: { loanAccountId: loanAccount.id } });
  if (loanAccount.coBorrowerIds.length > 0) {
    await client.loanAccountCoBorrower.createMany({
      data: loanAccount.coBorrowerIds.map((coBorrowerId) => ({ loanAccountId: loanAccount.id, coBorrowerId })),
    });
  }
}

export class PrismaLoanAccountRepository implements ILoanAccountRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<LoanAccount | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAccount.findUnique({ where: { id }, include: LOAN_ACCOUNT_INCLUDE });
    return row ? toDomain(row) : null;
  }

  async findByLoanCode(loanCode: string, ctx?: TransactionContext): Promise<LoanAccount | null> {
    const client = resolveClient(ctx);
    const row = await client.loanAccount.findUnique({ where: { loanCode }, include: LOAN_ACCOUNT_INCLUDE });
    return row ? toDomain(row) : null;
  }

  /** Frontend↔Backend Wiring Pilot follow-up (2026-07-09): borrowerId equality filter combined with the pre-existing branch/search filters. */
  async findMany(options: FindManyLoanAccountsOptions, ctx?: TransactionContext): Promise<LoanAccount[]> {
    const client = resolveClient(ctx);
    const where: Prisma.LoanAccountWhereInput = {
      ...(options.branchId ? { branchId: options.branchId } : {}),
      ...(options.borrowerId ? { borrowerId: options.borrowerId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.loanProductVersionIds && options.loanProductVersionIds.length > 0
        ? { loanProductVersionId: { in: options.loanProductVersionIds } }
        : {}),
      ...(options.search
        ? {
            OR: [
              { loanCode: { contains: options.search, mode: 'insensitive' } },
              { borrower: { firstName: { contains: options.search, mode: 'insensitive' } } },
              { borrower: { lastName: { contains: options.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const rows = await client.loanAccount.findMany({
      where,
      include: LOAN_ACCOUNT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomain);
  }

  async save(loanAccount: LoanAccount, ctx?: TransactionContext): Promise<void> {
    if (ctx) {
      await writeGraph(resolveClient(ctx), loanAccount);
      return;
    }
    await prisma.$transaction((tx) => writeGraph(tx, loanAccount));
  }

  async findMaxLoanCodeSequenceForPrefix(prefix: string, ctx?: TransactionContext): Promise<number> {
    const client = resolveClient(ctx);
    const rows = await client.loanAccount.findMany({
      where: { loanCode: { startsWith: `${prefix}_` } },
      select: { loanCode: true },
    });
    let max = 0;
    for (const row of rows) {
      const suffix = row.loanCode.slice(prefix.length + 1);
      const n = Number.parseInt(suffix, 10);
      if (Number.isInteger(n) && n > max) max = n;
    }
    return max;
  }

  /** Same maturity definition as `PrismaDashboardRepository.findOverdueLoanAccounts` (2026-07-12) -
   * kept in sync deliberately so the Dashboard's Loan Portfolio Health "Matured" segment and this
   * per-loan badge never disagree. See that function's own doc comment for the full rationale. */
  async findMaturedLoanAccountIds(loanAccountIds: string[], ctx?: TransactionContext): Promise<Set<string>> {
    if (loanAccountIds.length === 0) return new Set();
    const client = resolveClient(ctx);
    const now = new Date();
    const rows = await client.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH overdue AS (
        SELECT DISTINCT rs."loanAccountId" AS id
        FROM repayment_schedules rs
        JOIN loan_accounts la ON la.id = rs."loanAccountId"
        WHERE rs."dueDate" < ${now}
          AND (rs."principalPaid" + rs."interestPaid" + rs."feesPaid" + rs."penaltyPaid")
              < (rs."principalDue" + rs."interestDue" + rs."feesDue" + rs."penaltyDue")
          AND la.status IN ('ACTIVE', 'ACTIVE_IN_ARREARS')
          AND la.id IN (${Prisma.join(loanAccountIds)})
      ),
      maturity AS (
        SELECT "loanAccountId" AS id, MAX("dueDate") AS maturity_date
        FROM repayment_schedules
        WHERE "loanAccountId" IN (${Prisma.join(loanAccountIds)})
        GROUP BY "loanAccountId"
      )
      SELECT overdue.id
      FROM overdue
      JOIN maturity ON maturity.id = overdue.id
      WHERE maturity.maturity_date < ${now}
    `);
    return new Set(rows.map((r) => r.id));
  }
}
