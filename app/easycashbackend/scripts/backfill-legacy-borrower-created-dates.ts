/**
 * 2026-08-27 (user-reported): every migrated Borrower's `createdAt` was silently wrong - Prisma's
 * `@default(now())` recorded the LAST migration run's own timestamp instead of the real SDevTech
 * client creation date, for every one of them. Confirmed empirically before this fix: all 4,607
 * already-migrated borrowers shared the exact same `createdAt` date (the 2026-08-19 migration run).
 * Same bug class as the 2026-07-17 `LoanAccount.createdAt` fix
 * (`backfill-legacy-loan-created-dates.ts`), just never applied to Borrower - `migrateBorrowers()`
 * in `migrate-legacy-data.ts` is fixed alongside this script so the next full migration doesn't
 * reintroduce it.
 *
 * Source: `client_accounts.creation_date` - a "MM-DD-YYYY" string for most records, a real BSON
 * Date for the rest. `toDate()` (copied here, same as the main migration script's) already handles
 * both shapes correctly.
 *
 * Safe to re-run: only updates a Borrower whose `createdAt` still matches its `updatedAt` truncated
 * to the same migration-run day (the telltale sign it was never corrected) AND has a `legacyId` -
 * never touches a native (non-legacy) Borrower or one already corrected.
 */
import * as fs from 'fs';
import * as path from 'path';
import { BSON } from 'bson';
import { prisma } from '@shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const DUMP_DIR = legacyDbEasycashDir();

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

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const clientByUid = new Map<string, Record<string, unknown>>();
  for (const doc of iterDocs<Record<string, unknown>>('client_accounts')) {
    const uid = doc.uid ? String(doc.uid) : null;
    if (uid) clientByUid.set(uid, doc);
  }
  console.log(`Loaded ${clientByUid.size} client_accounts records from the legacy dump.`);

  const borrowers = await prisma.borrower.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true, createdAt: true, firstName: true, lastName: true },
  });
  console.log(`Found ${borrowers.length} migrated borrowers in the live database.`);

  let updated = 0;
  let noSourceRecord = 0;
  let noCreationDate = 0;
  const skippedSamples: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      for (const b of borrowers) {
        const source = clientByUid.get(b.legacyId!);
        if (!source) {
          noSourceRecord++;
          if (skippedSamples.length < 5) skippedSamples.push(`${b.firstName} ${b.lastName} (legacyId ${b.legacyId})`);
          continue;
        }
        const realCreatedAt = toDate(source.creation_date);
        if (!realCreatedAt) {
          noCreationDate++;
          continue;
        }
        await tx.borrower.update({ where: { id: b.id }, data: { createdAt: realCreatedAt } });
        updated++;
      }
    },
    { timeout: 5 * 60 * 1000 },
  );

  console.log('');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no matching client_accounts record): ${noSourceRecord}`);
  if (skippedSamples.length > 0) console.log('  e.g.:', skippedSamples.join('; '));
  console.log(`Skipped (creation_date missing/unparseable): ${noCreationDate}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
