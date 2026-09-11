/* eslint-disable no-console */
/**
 * Loan-accounts-only legacy sync (2026-09-07, user request; extended same day to also cover
 * repayment schedules and payment history).
 *
 * A scoped sibling of `migrate-legacy-data.ts` that touches exactly three tables: `loan_accounts`,
 * `repayment_schedules`, and `loan_transactions` - nothing else (no comments, attachments,
 * co-borrowers, borrowers, or loan products). The full migration script processes all of those in
 * one run; the user explicitly asked for a tool whose blast radius is limited to a loan account and
 * its own schedule/payment history, so this script exists instead of adding a "skip other phases"
 * flag to the full script (keeping the two scripts' blast radius impossible to confuse).
 *
 * Borrower and LoanProductVersion references (needed by Phase 1) are resolved by reading their
 * `legacyId` directly from Postgres (read-only SELECTs) rather than re-processing
 * client_accounts.bson/loan_products.bson through their own migration logic - those collections are
 * assumed already migrated by `migrate-legacy-data.ts`. A loan whose borrower or product isn't found
 * yet is skipped (reported in the reconciliation output), never fabricated.
 *
 * Each phase mirrors its counterpart in migrate-legacy-data.ts / migrate-repayment-schedules.ts
 * field-for-field (kept in sync deliberately - see each phase's own comment for the reasoning this
 * was copied from) and shares the same safety model:
 *   - Upserts on `legacyId` - idempotent, safe to re-run against a fresher dump anytime.
 *   - A loan that already has real LMS-posted activity (a LoanTransaction with legacyId IS NULL)
 *     is "locked": Phase 1 never resyncs its status/balance fields again, Phase 2 never resyncs its
 *     installments' paid amounts/status again, and Phase 3 skips importing SDevTech transactions
 *     for it entirely (never partially imports/de-dupes row by row).
 *   - Balance fields (Phase 1) are never defaulted to 0 when the source has no balance snapshot at
 *     all (would silently erase a real balance correction done via
 *     recompute-active-loan-balances-from-schedule.ts).
 *   - `firstRepaymentDate` (Phase 1) is never fabricated (ADR-045) - a loan missing it in both
 *     disbursements.bson and repayments.bson is skipped, not guessed.
 *
 * Usage:
 *   npx tsx scripts/sync-loan-accounts-only.ts                                   # dry run, all loans
 *   npx tsx scripts/sync-loan-accounts-only.ts --apply                           # apply, all loans
 *   npx tsx scripts/sync-loan-accounts-only.ts --only=SML-REG_00389,SML-REG_00390 --apply
 *
 * `--only` (2026-09-07, user request): a comma-separated list of loan codes (the same value as
 * `loan_accounts.id` in the source dump / `LoanAccount.loanCode` once migrated) to restrict ALL
 * THREE phases to. Without it, every run reprocesses the entire loan_accounts.bson - which,
 * because Phase 1 upserts any loan whose borrower/product happens to now be resolvable (not just
 * ones that are new today), can silently resurface old backlog loans that were previously stuck on
 * "unresolved borrower"/"unresolved product" and only became migratable once that dependency was
 * separately added later - exactly what happened the first time this script ran without `--only`
 * (see session log §119: 4 unrelated 2025/2026 loans got pulled in alongside the 2 intended ones,
 * had to be identified via an exact pre/post backup diff and manually removed, including their
 * repayment_schedules/loan_transactions rows, not once but twice). Prefer `--only` whenever the
 * intent is "bring in these specific loans" rather than "catch this system fully up.".
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
const BATCH_SIZE = 2000;

const ONLY_ARG = process.argv.find((a) => a.startsWith('--only='));
const ONLY_LOAN_CODES = ONLY_ARG
  ? new Set(
      ONLY_ARG.slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null;

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

interface Reconciliation {
  collection: string;
  sourceCount: number;
  migrated: number;
  skipped: number;
  skipReasons: Map<string, number>;
}

function newReconciliation(collection: string, sourceCount: number): Reconciliation {
  return { collection, sourceCount, migrated: 0, skipped: 0, skipReasons: new Map() };
}

function recordSkip(rec: Reconciliation, reason: string): void {
  rec.skipped++;
  rec.skipReasons.set(reason, (rec.skipReasons.get(reason) ?? 0) + 1);
}

function printReconciliation(recs: Reconciliation[]): void {
  console.log('\n=== Reconciliation ===');
  for (const r of recs) {
    console.log(`${r.collection}: source=${r.sourceCount} migrated=${r.migrated} skipped=${r.skipped}`);
    for (const [reason, count] of r.skipReasons) {
      console.log(`    skipped (${reason}): ${count}`);
    }
  }
}

// ----------------------------------------------------------------------------
// Phase 1: LoanAccount - copied from migrate-legacy-data.ts's migrateLoanAccounts (see that
// function's own comments for the full reasoning behind each rule below).
// ----------------------------------------------------------------------------

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

async function syncLoanAccounts(
  hqBranchId: string,
  lockedLoanAccountIds: Set<string>,
): Promise<{ rec: Reconciliation; loanAccountIdByLegacyKey: Map<string, string> }> {
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

  const allLoans = loadAll<any>('loan_accounts');
  const loans = ONLY_LOAN_CODES ? allLoans.filter((la) => ONLY_LOAN_CODES.has(String(la.id))) : allLoans;
  const rec = newReconciliation('loan_accounts', loans.length);
  const loanAccountIdByLegacyKey = new Map<string, string>();

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

      const loanAccount = await prisma.loanAccount.upsert({
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
      loanAccountIdByLegacyKey.set(legacyId, loanAccount.id);
    } else {
      loanAccountIdByLegacyKey.set(legacyId, `dry-run:${legacyId}`);
    }
    rec.migrated++;
  }

  return { rec, loanAccountIdByLegacyKey };
}

// ----------------------------------------------------------------------------
// Phase 2: RepaymentSchedule - copied from migrate-repayment-schedules.ts (see that script's own
// comments for the full reasoning, in particular the installment-numbering-by-due_date rule and
// the "SDevTech's payment_schedules.bson is empty; repayments.bson is the real per-installment
// schedule" finding).
// ----------------------------------------------------------------------------

async function syncRepaymentSchedules(lockedLoanAccountIds: Set<string>): Promise<Reconciliation> {
  const legacyLoans = loadAll<{ uid: string; id: string }>('loan_accounts');
  const scopedLoans = ONLY_LOAN_CODES ? legacyLoans.filter((l) => ONLY_LOAN_CODES.has(String(l.id))) : legacyLoans;
  const loanUidSet = new Set(scopedLoans.map((l) => l.uid));

  const repayments = loadAll<any>('repayments');
  const rec = newReconciliation('repayment_schedules', repayments.length);

  const byLoanUid = new Map<string, any[]>();
  for (const r of repayments) {
    if (!loanUidSet.has(r.parent_account_key)) continue;
    if (!byLoanUid.has(r.parent_account_key)) byLoanUid.set(r.parent_account_key, []);
    byLoanUid.get(r.parent_account_key)!.push(r);
  }

  for (const [loanUid, records] of byLoanUid) {
    const loanAccount = APPLY
      ? await prisma.loanAccount.findUnique({ where: { legacyId: loanUid }, select: { id: true } })
      : { id: `dry-run:${loanUid}` };
    if (!loanAccount) {
      recordSkip(rec, 'unresolved loan account (not yet migrated)');
      continue;
    }

    records.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const isLocked = lockedLoanAccountIds.has(loanAccount.id);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const legacyId = String(r._id);
      if (APPLY) {
        const paymentSnapshot = {
          principalPaid: toDecimalString(r.principal_paid),
          interestPaid: toDecimalString(r.interest_paid),
          feesPaid: toDecimalString(r.fees_paid),
          penaltyPaid: toDecimalString(r.penalty_paid),
          status: r.state,
          lastPaidAt: r.last_paid_date ? new Date(r.last_paid_date) : null,
        };
        await prisma.repaymentSchedule.upsert({
          where: { legacyId },
          create: {
            legacyId,
            loanAccountId: loanAccount.id,
            installmentNumber: i + 1,
            dueDate: new Date(r.due_date),
            principalDue: toDecimalString(r.principal_due),
            interestDue: toDecimalString(r.interest_due),
            feesDue: toDecimalString(r.fees_due),
            penaltyDue: toDecimalString(r.penalty_due),
            ...paymentSnapshot,
          },
          update: isLocked ? {} : paymentSnapshot,
        });
      }
      rec.migrated++;
    }
  }

  return rec;
}

// ----------------------------------------------------------------------------
// Phase 3: LoanTransaction - copied from migrate-legacy-data.ts's migrateLoanTransactions (see
// that function's own comments for the full reasoning behind the type mapping and the OR/AR
// number / channel enrichment joins).
// ----------------------------------------------------------------------------

const TRANSACTION_TYPE_MAP: Record<string, string> = {
  DISBURSMENT: 'DISBURSEMENT',
  REPAYMENT: 'REPAYMENT',
  FEE_CHARGED: 'FEE_CHARGED',
  FEE: 'FEE_CHARGED',
  PENALTY_APPLIED: 'PENALTY_APPLIED',
  INTEREST_APPLIED: 'INTEREST_APPLIED',
  DEFERRED_INTEREST_APPLIED: 'DEFERRED_INTEREST_APPLIED',
  DEFERRED_INTEREST_PAID: 'DEFERRED_INTEREST_PAID',
  TRANSFER: 'TRANSFER',
  WRITE_OFF: 'ADJUSTMENT',
  REPAYMENT_UNDO: 'ADJUSTMENT',
  FEE_REPAYMENT: 'FEE_REPAYMENT',
  PENALTY_REPAYMENT: 'PENALTY_REPAYMENT',
  FEES_DUE_REDUCED: 'ADJUSTMENT',
  PENALTIES_DUE_REDUCED: 'ADJUSTMENT',
  INTEREST_DUE_REDUCED: 'ADJUSTMENT',
  PENALTY_ADJUSTMENT: 'ADJUSTMENT',
  FEE_ADJUSTMENT: 'ADJUSTMENT',
  FEE_REDUCTION_ADJUSTMENT: 'ADJUSTMENT',
  INTEREST_APPLIED_ADJUSTMENT: 'ADJUSTMENT',
  INTEREST_REDUCTION_ADJUSTMENT: 'ADJUSTMENT',
  DEFERRED_INTEREST_APPLIED_ADJUSTMENT: 'ADJUSTMENT',
  DEFERRED_INTEREST_PAID_ADJUSTMENT: 'ADJUSTMENT',
  DISBURSMENT_ADJUSTMENT: 'ADJUSTMENT',
  REPAYMENT_ADJUSTMENT: 'ADJUSTMENT',
  PENALTY_REDUCTION_ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER_ADJUSTMENT: 'ADJUSTMENT',
  WRITE_OFF_ADJUSTMENT: 'ADJUSTMENT',
  // IMPORT deliberately absent - excluded, see migrate-legacy-data.ts's design doc reference.
};

const OR_NUMBER_CUSTOM_FIELD_KEY = '8a8e8f8f815c2b190181602dc7345763';
const AR_NUMBER_CUSTOM_FIELD_KEY = '8a8e8efa81ead99e0181efde2b034e5e';

interface TransactionEnrichment {
  channelNameByDetailsUid: Map<string, string>;
  orNumberByTxUid: Map<string, string>;
  arNumberByTxUid: Map<string, string>;
}

function loadTransactionEnrichment(): TransactionEnrichment {
  const channelNameByKey = new Map<string, string>();
  for (const ch of iterDocs<any>('transaction_channels')) {
    channelNameByKey.set(String(ch.uid ?? ch._id), String(ch.name));
  }

  const channelNameByDetailsUid = new Map<string, string>();
  for (const detail of iterDocs<any>('transaction_details')) {
    const channelKey = (detail as any).transaction_channel_key;
    if (!channelKey) continue;
    const name = channelNameByKey.get(String(channelKey));
    if (name) channelNameByDetailsUid.set(String((detail as any).uid ?? (detail as any)._id), name);
  }

  const orNumberByTxUid = new Map<string, string>();
  const arNumberByTxUid = new Map<string, string>();
  for (const cfv of iterDocs<any>('custom_field_values')) {
    const key = String((cfv as any).custom_field_key);
    if (key !== OR_NUMBER_CUSTOM_FIELD_KEY && key !== AR_NUMBER_CUSTOM_FIELD_KEY) continue;
    const value = (cfv as any).value;
    if (value === null || value === undefined || String(value).trim() === '') continue;
    const target = key === OR_NUMBER_CUSTOM_FIELD_KEY ? orNumberByTxUid : arNumberByTxUid;
    target.set(String((cfv as any).parent_key), String(value));
  }

  return { channelNameByDetailsUid, orNumberByTxUid, arNumberByTxUid };
}

async function syncLoanTransactions(
  hqBranchId: string,
  loanAccountIdByLegacyKey: Map<string, string>,
  lockedLoanAccountIds: Set<string>,
): Promise<Reconciliation> {
  const rec = newReconciliation('loan_transactions', 0);
  const enrichment = loadTransactionEnrichment();
  let batch: any[] = [];

  async function flush(): Promise<void> {
    if (batch.length === 0) return;
    if (APPLY) {
      await prisma.$transaction(
        batch.map((row) =>
          prisma.loanTransaction.upsert({
            where: { legacyId: row.legacyId },
            update: { orNumber: row.orNumber, arNumber: row.arNumber, paymentMethod: row.paymentMethod },
            create: row,
          }),
        ),
      );
    }
    rec.migrated += batch.length;
    batch = [];
  }

  for (const tx of iterDocs<any>('loan_transactions')) {
    rec.sourceCount++;
    const legacyType = String(tx.type);
    if (legacyType === 'IMPORT') {
      recordSkip(rec, 'IMPORT (not a real financial event)');
      continue;
    }
    const mappedType = TRANSACTION_TYPE_MAP[legacyType];
    if (!mappedType) {
      recordSkip(rec, `unmapped type=${legacyType}`);
      continue;
    }
    const loanAccountId = loanAccountIdByLegacyKey.get(String(tx.parent_account_key));
    if (!loanAccountId) {
      recordSkip(rec, 'unresolved loan account');
      continue;
    }
    if (lockedLoanAccountIds.has(loanAccountId)) {
      recordSkip(rec, 'loan account is locked (has a native transaction) - never imports SDevTech transactions again');
      continue;
    }
    const entryDate = toDate(tx.entry_date ?? tx.creation_date);
    if (!entryDate) {
      recordSkip(rec, 'missing entry date');
      continue;
    }

    const txUid = String(tx.uid ?? tx._id);
    const channel = tx.details_encoded_oid ? enrichment.channelNameByDetailsUid.get(String(tx.details_encoded_oid)) : undefined;

    batch.push({
      loanAccountId,
      type: mappedType,
      amount: toDecimalString(tx.amount ?? 0),
      principalComponent: toDecimalString(tx.principal_amount ?? 0),
      interestComponent: toDecimalString(tx.interest_amount ?? 0),
      feesComponent: toDecimalString(tx.fees_amount ?? 0),
      penaltyComponent: toDecimalString(tx.penalty_amount ?? 0),
      balanceAfter: toDecimalString(tx.balance ?? tx.principal_balance ?? 0),
      branchId: hqBranchId,
      entryDate,
      comment: tx.comment || null,
      legacyId: txUid,
      orNumber: enrichment.orNumberByTxUid.get(txUid),
      arNumber: enrichment.arNumberByTxUid.get(txUid),
      paymentMethod: channel,
    });

    if (batch.length >= BATCH_SIZE) {
      await flush();
      console.log(`  ...${rec.migrated} transactions synced so far`);
    }
  }
  await flush();

  return rec;
}

// ----------------------------------------------------------------------------

/**
 * 2026-09-11 (user request): a human-readable preview - loan code, resolved borrower name, amount,
 * account state - printed before any writes happen, in BOTH dry-run and --apply mode. Built after
 * a manual review of a real dump turned up two real anomalies a bare loan-code list wouldn't have
 * surfaced (see session log): a loan `id` appearing twice in the same dump for two entirely
 * different borrowers, and one loan two orders of magnitude larger than every other loan in the
 * batch. Neither is fabricated or auto-corrected here - both are just flagged, same "never guess,
 * surface it" posture as everything else in this script.
 */
function printPreview(): void {
  const allLoans = loadAll<Record<string, unknown>>('loan_accounts');
  const scoped = ONLY_LOAN_CODES ? allLoans.filter((la) => ONLY_LOAN_CODES.has(String(la.id))) : allLoans;
  if (scoped.length === 0) {
    console.log('=== Preview ===\nNo loans match the given --only filter (or the dump is empty).\n');
    return;
  }

  const idCounts = new Map<string, number>();
  for (const la of allLoans) {
    const id = String(la.id);
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const clientsByKey = new Map<string, Record<string, unknown>>();
  for (const c of iterDocs<Record<string, unknown>>('client_accounts')) {
    clientsByKey.set(String(c.uid ?? c._id), c);
  }

  console.log(`=== Preview: ${scoped.length} loan(s) in scope ===`);
  const amounts: number[] = [];
  for (const la of scoped) {
    const id = String(la.id);
    const holderKey = String(la.accountHolderKey ?? '');
    const client = clientsByKey.get(holderKey);
    const name = client ? String(client.full_name ?? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()) : null;
    const amount = typeof la.loanAmount === 'number' ? la.loanAmount : null;
    if (amount !== null) amounts.push(amount);

    const flags: string[] = [];
    if ((idCounts.get(id) ?? 0) > 1) flags.push('DUPLICATE loan code in dump - will be suffixed -LEGACY2/3/...');
    if (!name) flags.push(`borrower not found in dump (accountHolderKey=${holderKey || 'blank'}) - will be SKIPPED`);

    console.log(
      `  ${id}  ->  ${name ?? '(unresolved)'}  [${la.accountState ?? 'n/a'}, ${amount !== null ? `₱${amount.toLocaleString()}` : 'n/a'}]` +
        (flags.length ? `\n      ⚠ ${flags.join('; ')}` : ''),
    );
  }

  if (amounts.length > 0) {
    const median = [...amounts].sort((a, b) => a - b)[Math.floor(amounts.length / 2)]!;
    const outliers = amounts.filter((a) => a > median * 10);
    if (outliers.length > 0) {
      console.log(`  ⚠ ${outliers.length} loan(s) are 10x+ the median amount (₱${median.toLocaleString()}) in this batch - double-check these are correct, not data errors.`);
    }
  }
  console.log('');
}

async function main(): Promise<void> {
  console.log(`=== Loan account + schedule + payment history sync (${APPLY ? 'APPLY' : 'dry run'}) ===`);
  console.log(`Reading dump: ${DUMP_DIR}\n`);
  console.log('Scope: writes ONLY to loan_accounts, repayment_schedules, and loan_transactions.');
  console.log(
    ONLY_LOAN_CODES
      ? `Loan filter: ONLY these loan codes will be touched: ${[...ONLY_LOAN_CODES].join(', ')}\n`
      : 'Loan filter: none - every loan in the dump will be (re-)considered. Pass --only=CODE1,CODE2 to restrict.\n',
  );

  printPreview();

  const branch = await prisma.branch.findUnique({ where: { code: HQ_BRANCH_CODE } });
  if (!branch) {
    throw new Error(`No Branch with code "${HQ_BRANCH_CODE}" found. Run "npx prisma db seed" first.`);
  }
  const hqBranchId = branch.id;

  // Shared across all three phases - a loan with real LMS-posted activity is never resynced from
  // the legacy source again, in any of the three tables. Recomputed once up front; Phase 1 may add
  // brand-new loan accounts this run, but a brand-new loan account can't already be locked (no
  // LoanTransaction could exist for it before it existed), so a single pre-computed snapshot is
  // correct for all three phases.
  const lockedLoanAccountIds = new Set(
    (
      await prisma.loanTransaction.findMany({
        where: { legacyId: null, loanAccount: { legacyId: { not: null } } },
        select: { loanAccountId: true },
        distinct: ['loanAccountId'],
      })
    ).map((t) => t.loanAccountId),
  );

  console.log('Phase 1/3: LoanAccount...');
  const { rec: loanAccountsRec, loanAccountIdByLegacyKey } = await syncLoanAccounts(hqBranchId, lockedLoanAccountIds);

  console.log('Phase 2/3: RepaymentSchedule...');
  const repaymentSchedulesRec = await syncRepaymentSchedules(lockedLoanAccountIds);

  console.log('Phase 3/3: LoanTransaction...');
  const loanTransactionsRec = await syncLoanTransactions(hqBranchId, loanAccountIdByLegacyKey, lockedLoanAccountIds);

  printReconciliation([loanAccountsRec, repaymentSchedulesRec, loanTransactionsRec]);

  if (APPLY) {
    console.log('\nApply complete - only loan_accounts, repayment_schedules, and loan_transactions were written to.');
  } else {
    console.log('\nDry run complete — no data was written. Re-run with --apply to write.');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
