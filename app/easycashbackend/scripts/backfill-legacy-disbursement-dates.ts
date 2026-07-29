/* eslint-disable no-console */
/**
 * CP12 follow-up — corrects `LoanAccount.activatedAt` for legacy-migrated loans.
 *
 * Bug: `migrate-legacy-data.ts` (see its `migrateLoanAccounts()`) set `activatedAt` from
 * `la.creationDate` (the legacy loan-account record's creation timestamp) instead of the real
 * disbursement date. `activatedAt` is what the rest of this codebase treats as the official
 * Disbursement Date (ADR-032; read by `LoanDocumentMergeDataResolver` and the Loan Releases
 * report) — so every legacy loan's "Disbursement Date" has actually been showing its account
 * creation date. Reported by the user 2026-07-17: two dates were visible where one should be —
 * confirmed against the raw legacy dump (`legacy/MongoDB dump/.../disbursements.bson`): of 1,798
 * legacy loans with a resolvable disbursement record, 1,131 (63%) differ from the real
 * `disbursment_date` [sic, legacy typo] by more than a day.
 *
 * User-confirmed fix (2026-07-17): re-derive `activatedAt` from `disbursements.disbursment_date`,
 * falling back to `disbursements.expected_disbursement_date` when the real one is missing (23
 * loans lack `disbursment_date` outright). Only touches rows that came from the legacy migration
 * (`legacyId` set) — loans created directly in this system already have a correct `activatedAt`
 * set by `ActivateLoanUseCase`.
 *
 * Never touches the legacy dump itself (read-only, same as migrate-legacy-data.ts). Idempotent:
 * safe to re-run — always recomputes from the same source dump and writes the same result.
 *
 * Usage:
 *   npx tsx scripts/backfill-legacy-disbursement-dates.ts            # dry run — reports only
 *   npx tsx scripts/backfill-legacy-disbursement-dates.ts --apply    # writes to DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const DUMP_DIR = path.resolve(__dirname, '../../../legacy/MongoDB dump/extracted/07142026_ 84746/db-easycash');

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

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main(): Promise<void> {
  const disbursementsByUid = indexBy(loadAll<any>('disbursements'), 'uid');
  const legacyLoans = loadAll<any>('loan_accounts');

  let sourceMissing = 0;
  let usedRealDate = 0;
  let usedFallback = 0;
  let flaggedNoSource = 0;
  let notFoundInDb = 0;
  let alreadyCorrect = 0;
  let toUpdate = 0;

  const updates: { legacyId: string; loanCode: string; oldValue: Date | null; newValue: Date; source: 'real' | 'fallback' }[] = [];
  const flagged: { legacyId: string }[] = [];

  for (const la of legacyLoans) {
    const legacyId = String(la.uid ?? la._id);
    const disb = disbursementsByUid.get(String(la.disbursementDetailsKey));
    if (!disb) {
      sourceMissing++;
      continue;
    }

    const realDate = toDate(disb.disbursment_date);
    const fallbackDate = toDate(disb.expected_disbursement_date);
    const correctDate = realDate ?? fallbackDate;

    if (!correctDate) {
      flaggedNoSource++;
      flagged.push({ legacyId });
      continue;
    }
    if (realDate) usedRealDate++;
    else usedFallback++;

    const existing = await prisma.loanAccount.findUnique({ where: { legacyId }, select: { activatedAt: true, loanCode: true } });
    if (!existing) {
      notFoundInDb++;
      continue;
    }

    if (existing.activatedAt && existing.activatedAt.getTime() === correctDate.getTime()) {
      alreadyCorrect++;
      continue;
    }

    toUpdate++;
    updates.push({
      legacyId,
      loanCode: existing.loanCode,
      oldValue: existing.activatedAt,
      newValue: correctDate,
      source: realDate ? 'real' : 'fallback',
    });
  }

  console.log('--- Backfill: LoanAccount.activatedAt (legacy disbursement date) ---');
  console.log({
    legacyLoanRecords: legacyLoans.length,
    sourceMissing_noDisbursementRecordFound: sourceMissing,
    flaggedNoSource_noDateAtAllInLegacyRecord: flaggedNoSource,
    notFoundInDb_notMigratedOrSkipped: notFoundInDb,
    alreadyCorrect,
    willUpdate: toUpdate,
    updatesUsingRealDisbursmentDate: usedRealDate,
    updatesUsingExpectedDateFallback: usedFallback,
  });

  if (flagged.length > 0) {
    console.log(`\nFlagged - no disbursement date at all in legacy record (left untouched, activatedAt stays whatever it currently is):`);
    console.log(flagged.map((f) => f.legacyId).join(', '));
  }

  console.log(`\nSample of ${Math.min(10, updates.length)} updates:`);
  for (const u of updates.slice(0, 10)) {
    console.log(`  ${u.loanCode} (${u.legacyId}): ${u.oldValue?.toISOString() ?? 'null'} -> ${u.newValue.toISOString()} [${u.source}]`);
  }

  if (!APPLY) {
    console.log('\nDry run only - no writes made. Re-run with --apply to write these changes.');
    return;
  }

  console.log(`\nApplying ${updates.length} updates...`);
  for (const u of updates) {
    await prisma.loanAccount.update({ where: { legacyId: u.legacyId }, data: { activatedAt: u.newValue } });
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
