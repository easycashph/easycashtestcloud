/* eslint-disable no-console */
/**
 * Loan-accounts-only legacy sync (2026-09-07, user request).
 *
 * A scoped sibling of `migrate-legacy-data.ts` that touches exactly one table: `loan_accounts`.
 * The full migration script also processes loan_transactions (500k+ rows), comments, attachments,
 * co-borrowers, etc. in the same run - the user explicitly asked for a tool that does nothing
 * beyond syncing loan accounts themselves, so this script exists instead of adding a "skip other
 * phases" flag to the full script (keeping the two scripts' blast radius impossible to confuse).
 *
 * Borrower and LoanProductVersion references are resolved by reading their `legacyId` directly
 * from Postgres (read-only SELECTs) rather than re-processing client_accounts.bson/loan_products.bson
 * through their own migration logic - those collections are assumed already migrated by
 * `migrate-legacy-data.ts`. A loan whose borrower or product isn't found yet is skipped (reported
 * in the reconciliation output), never fabricated.
 *
 * Same safety model as migrate-legacy-data.ts's `migrateLoanAccounts` (kept in sync deliberately -
 * see that function's own doc comment for the full reasoning):
 *   - Upserts on `legacyId` - idempotent, safe to re-run against a fresher dump anytime.
 *   - A loan that already has real LMS-posted activity (a LoanTransaction with legacyId IS NULL)
 *     is "locked" and never resynced from the legacy source again.
 *   - Balance fields are never defaulted to 0 when the source has no balance snapshot at all
 *     (would silently erase a real balance correction done via
 *     recompute-active-loan-balances-from-schedule.ts).
 *   - `firstRepaymentDate` is never fabricated (ADR-045) - a loan missing it in both
 *     disbursements.bson and repayments.bson is skipped, not guessed.
 *
 * Usage:
 *   npx tsx scripts/sync-loan-accounts-only.ts            # dry run - reports counts, writes nothing
 *   npx tsx scripts/sync-loan-accounts-only.ts --apply    # writes to loan_accounts only
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const APPLY = process.argv.includes('--apply');
const DUMP_DIR = legacyDbEasycashDir();
const HQ_BRANCH_CODE = 'HQ';

function* iterDocs<T = Record<string, unknown>>(collection: string): Generator<T> {
  const file = path.join(DUMP_DIR, `${collection}.bson`);
  const buf = fs.readFileSync(file);
  let offset = 0;
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    if (size <= 0) break;
    yield BSON.deserialize(buf.subarray(offset, offset + size)) as T;
    offset += size;
  }
}

function loadAll<T = Record<string, unknown>>(collection: string): T[] {
  return [...iterDocs<T>(collection)];
}

function indexBy<T extends Record<string, unknown>>(docs: T[], key: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const d of docs) {
    const k = d[key];
    if (k !== undefined && k !== null) map.set(String(k), d);
  }
  return map;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDecimalString(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

// Copied verbatim from migrate-legacy-data.ts - keep these two in sync if the legacy status/closure
// mapping rules ever change there.
const LOAN_STATUS_MAP: Record<string, string> = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  ACTIVE_IN_ARREARS: 'ACTIVE_IN_ARREARS',
};

function resolveLoanStatus(la: any): string | undefined {
  const base = LOAN_STATUS_MAP[String(la.accountState)];
  if (base) return base;
  if (String(la.accountState) !== 'CLOSED') return undefined;
  const reason = String(la.closureReason ?? '').trim();
  if (reason === 'Reschedule') return 'CLOSED_RESTRUCTURED';
  if (reason === 'Compromise Agreement') return 'CLOSED_COMPROMISED';
  return 'CLOSED';
}

interface Reconciliation {
  sourceCount: number;
  migrated: number;
  skipped: number;
  skipReasons: Map<string, number>;
}

function recordSkip(rec: Reconciliation, reason: string): void {
  rec.skipped++;
  rec.skipReasons.set(reason, (rec.skipReasons.get(reason) ?? 0) + 1);
}

async function main(): Promise<void> {
  console.log(`=== Loan-accounts-only sync (${APPLY ? 'APPLY' : 'dry run'}) ===`);
  console.log(`Reading dump: ${DUMP_DIR}\n`);

  const branch = await prisma.branch.findUnique({ where: { code: HQ_BRANCH_CODE } });
  if (!branch) {
    throw new Error(`No Branch with code "${HQ_BRANCH_CODE}" found. Run "npx prisma db seed" first.`);
  }
  const hqBranchId = branch.id;

  // Read-only lookups against already-migrated Postgres tables - never re-processes or writes to
  // borrowers/loan_product_versions themselves.
  const borrowerIdByLegacyId = new Map(
    (await prisma.borrower.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } })).map(
      (b) => [b.legacyId as string, b.id],
    ),
  );
  const productVersionIdByLegacyId = new Map(
    (
      await prisma.loanProductVersion.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } })
    ).map((p) => [p.legacyId as string, p.id]),
  );

  // Only a LoanAccount with real LMS-posted activity (a transaction with legacyId IS NULL) is
  // "locked" against being resynced from the legacy source - see this script's own doc comment.
  const lockedLoanAccountIds = new Set(
    (
      await prisma.loanTransaction.findMany({
        where: { legacyId: null, loanAccount: { legacyId: { not: null } } },
        select: { loanAccountId: true },
        distinct: ['loanAccountId'],
      })
    ).map((t) => t.loanAccountId),
  );

  const loanCodeUsageCount = new Map<string, number>();
  if (APPLY) {
    const existing = await prisma.loanAccount.findMany({ select: { loanCode: true } });
    for (const { loanCode } of existing) {
      const match = /^(.*)-LEGACY(\d+)$/.exec(loanCode);
      const base = match ? match[1]! : loanCode;
      const count = match ? Number(match[2]) : 1;
      loanCodeUsageCount.set(base, Math.max(loanCodeUsageCount.get(base) ?? 0, count));
    }
  }

  const disbursementsByUid = indexBy(loadAll<any>('disbursements'), 'uid');
  const earliestRepaymentDueDateByUid = new Map<string, Date>();
  for (const r of loadAll<any>('repayments')) {
    const uid = String(r.parent_account_key);
    const due = toDate(r.due_date);
    if (!due) continue;
    const existing = earliestRepaymentDueDateByUid.get(uid);
    if (!existing || due < existing) earliestRepaymentDueDateByUid.set(uid, due);
  }

  const loans = loadAll<any>('loan_accounts');
  const rec: Reconciliation = { sourceCount: loans.length, migrated: 0, skipped: 0, skipReasons: new Map() };

  for (const la of loans) {
    const legacyId = String(la.uid ?? la._id);
    const status = resolveLoanStatus(la);
    if (!status) {
      recordSkip(rec, `unmapped accountState=${la.accountState}`);
      continue;
    }
    const productVersionId = productVersionIdByLegacyId.get(String(la.productTypeKey));
    if (!productVersionId) {
      recordSkip(rec, 'unresolved loan product');
      continue;
    }
    const borrowerId = borrowerIdByLegacyId.get(String(la.accountHolderKey));
    if (!borrowerId) {
      recordSkip(rec, 'unresolved borrower');
      continue;
    }
    const disb = disbursementsByUid.get(String(la.disbursementDetailsKey));
    const firstRepaymentDate = toDate(disb?.first_repayment_date) ?? earliestRepaymentDueDateByUid.get(String(la.uid));
    const activatedAt = toDate(disb?.disbursment_date) ?? toDate(disb?.expected_disbursement_date);
    if (!firstRepaymentDate) {
      recordSkip(rec, 'missing firstRepaymentDate (no fabrication per ADR-045)');
      continue;
    }

    const baseCode = String(la.id ?? legacyId);
    const usageCount = (loanCodeUsageCount.get(baseCode) ?? 0) + 1;
    loanCodeUsageCount.set(baseCode, usageCount);
    const loanCode = usageCount === 1 ? baseCode : `${baseCode}-LEGACY${usageCount}`;

    if (APPLY) {
      const hasAccountLevelBalanceData = la.principalBalance !== undefined || la.interestBalance !== undefined;
      const balanceFields = {
        principalBalance: toDecimalString(la.principalBalance ?? 0),
        principalPaid: toDecimalString(la.principalPaid ?? 0),
        principalDue: toDecimalString(la.principalDue ?? 0),
        interestBalance: toDecimalString(la.interestBalance ?? 0),
        interestPaid: toDecimalString(la.interestPaid ?? 0),
        interestDue: toDecimalString(la.interestDue ?? 0),
        feesBalance: toDecimalString(la.feesBalance ?? 0),
        feesPaid: toDecimalString(la.feesPaid ?? 0),
        feesDue: toDecimalString(la.feesDue ?? 0),
        penaltyBalance: toDecimalString(la.penaltyBalance ?? 0),
        penaltyPaid: toDecimalString(la.penaltyPaid ?? 0),
        penaltyDue: toDecimalString(la.penaltyDue ?? 0),
      };
      const closedReason = la.closureReason ? String(la.closureReason) : null;
      const financialSnapshot = {
        status: status as never,
        ...balanceFields,
        approvedAt: toDate(la.approvedDate),
        activatedAt,
        closedAt: toDate(la.closedDate),
        closedReason,
      };
      const resyncSnapshot = hasAccountLevelBalanceData
        ? financialSnapshot
        : { status: status as never, approvedAt: toDate(la.approvedDate), activatedAt, closedAt: toDate(la.closedDate), closedReason };

      const existing = await prisma.loanAccount.findUnique({ where: { legacyId }, select: { id: true } });
      const isLocked = existing ? lockedLoanAccountIds.has(existing.id) : false;

      await prisma.loanAccount.upsert({
        where: { legacyId },
        update: isLocked ? {} : resyncSnapshot,
        create: {
          loanCode,
          borrowerId,
          loanProductVersionId: productVersionId,
          branchId: hqBranchId,
          createdAt: toDate(la.creationDate) ?? undefined,
          principalAmount: toDecimalString(la.loanAmount ?? la.principalBalance ?? 0),
          interestRate: toDecimalString(la.interestRate ?? 0),
          installmentCount: Number(la.repaymentInstallments ?? 1),
          repaymentPeriodUnit: 'MONTHS',
          gracePeriodDays: Number(la.gracePeriod ?? 0),
          firstRepaymentDate,
          legacyId,
          legacyBalanceDataMissing: !hasAccountLevelBalanceData,
          ...financialSnapshot,
        },
      });
    }
    rec.migrated++;
  }

  console.log('=== Reconciliation ===');
  console.log(`loan_accounts: source=${rec.sourceCount} migrated=${rec.migrated} skipped=${rec.skipped}`);
  for (const [reason, count] of rec.skipReasons) {
    console.log(`    skipped (${reason}): ${count}`);
  }

  if (APPLY) {
    console.log('\nApply complete - only the loan_accounts table was written to.');
  } else {
    console.log('\nDry run complete — no data was written. Re-run with --apply to write to loan_accounts.');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
