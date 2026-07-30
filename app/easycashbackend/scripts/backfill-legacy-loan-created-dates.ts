/* eslint-disable no-console */
/**
 * CP12 follow-up — corrects `LoanAccount.createdAt` for legacy-migrated loans.
 *
 * `migrate-legacy-data.ts` never set `createdAt` explicitly, so every migrated row got Prisma's
 * `@default(now())` - the timestamp the migration script happened to run, not when the loan
 * account was actually created in SDevTech. User-reported 2026-07-17 (as part of the same
 * disbursement-date investigation, see `backfill-legacy-disbursement-dates.ts`): the record's
 * "created" date should be the real SDevTech loan-account creation date.
 *
 * Initial theory - that the zero-principal `DISBURSEMENT`-typed `LoanTransaction` rows represent
 * the creation event - was checked against the data and ruled out: only 382/1783 (21%) of legacy
 * loans have one at all, and 305 of those (80%) postdate the loan's real disbursement (clustered
 * on specific days, e.g. 41 on 2024-04-29) - i.e. they're some other batch/administrative event,
 * not account creation. User-confirmed fix (2026-07-17): use `loan_accounts.creationDate` from
 * the legacy dump directly - present on all 1,805 legacy loan records, always before
 * `approvedDate`.
 *
 * Never touches the legacy dump itself (read-only, same as migrate-legacy-data.ts). Idempotent:
 * safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/backfill-legacy-loan-created-dates.ts            # dry run — reports only
 *   npx tsx scripts/backfill-legacy-loan-created-dates.ts --apply    # writes to DATABASE_URL
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

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main(): Promise<void> {
  const legacyLoans = loadAll<any>('loan_accounts');

  let missingCreationDate = 0;
  let notFoundInDb = 0;
  let alreadyCorrect = 0;
  let toUpdate = 0;

  const updates: { legacyId: string; loanCode: string; oldValue: Date; newValue: Date }[] = [];

  for (const la of legacyLoans) {
    const legacyId = String(la.uid ?? la._id);
    const newCreatedAt = toDate(la.creationDate);
    if (!newCreatedAt) {
      missingCreationDate++;
      continue;
    }

    const existing = await prisma.loanAccount.findUnique({ where: { legacyId }, select: { createdAt: true, loanCode: true } });
    if (!existing) {
      notFoundInDb++;
      continue;
    }

    if (existing.createdAt.getTime() === newCreatedAt.getTime()) {
      alreadyCorrect++;
      continue;
    }

    toUpdate++;
    updates.push({ legacyId, loanCode: existing.loanCode, oldValue: existing.createdAt, newValue: newCreatedAt });
  }

  console.log('--- Backfill: LoanAccount.createdAt (legacy loan-account creation date) ---');
  console.log({
    legacyLoanRecords: legacyLoans.length,
    missingCreationDate,
    notFoundInDb_notMigratedOrSkipped: notFoundInDb,
    alreadyCorrect,
    willUpdate: toUpdate,
  });

  console.log(`\nSample of ${Math.min(10, updates.length)} updates:`);
  for (const u of updates.slice(0, 10)) {
    console.log(`  ${u.loanCode} (${u.legacyId}): ${u.oldValue.toISOString()} -> ${u.newValue.toISOString()}`);
  }

  if (!APPLY) {
    console.log('\nDry run only - no writes made. Re-run with --apply to write these changes.');
    return;
  }

  console.log(`\nApplying ${updates.length} updates...`);
  for (const u of updates) {
    await prisma.loanAccount.update({ where: { legacyId: u.legacyId }, data: { createdAt: u.newValue } });
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
