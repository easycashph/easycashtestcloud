/**
 * 2026-08-27 (user request): pulls `client_accounts.facebook_link` from the SDevTech legacy dump
 * into `Borrower.facebookLink` for already-migrated clients. `migrateBorrowers()` in
 * `migrate-legacy-data.ts` is fixed alongside this script so the next full migration/reset picks
 * this up automatically for newly-created borrowers - this script exists only to backfill
 * borrowers that were already migrated before that fix landed.
 *
 * Confirmed via a direct BSON survey before writing this: 1,175 of 4,635 legacy clients have a
 * real, non-empty `facebook_link` value.
 *
 * Safe to re-run: only ever fills a Borrower whose `facebookLink` is currently NULL (i.e. either
 * never migrated, or genuinely never had one) - never overwrites a value a staff member entered or
 * edited manually, whether that borrower is legacy-migrated or native.
 *
 * Usage:
 *   npx tsx scripts/backfill-legacy-borrower-facebook-links.ts            # dry run
 *   npx tsx scripts/backfill-legacy-borrower-facebook-links.ts --apply    # writes to DATABASE_URL
 */
import * as fs from 'fs';
import * as path from 'path';
import { BSON } from 'bson';
import { prisma } from '@shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const APPLY = process.argv.includes('--apply');
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

async function main() {
  console.log(`Facebook Link backfill - mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Dump dir: ${DUMP_DIR}`);

  const facebookLinkByUid = new Map<string, string>();
  for (const doc of iterDocs<Record<string, unknown>>('client_accounts')) {
    const uid = doc.uid ? String(doc.uid) : null;
    const link = doc.facebook_link ? String(doc.facebook_link).trim() : '';
    if (uid && link) facebookLinkByUid.set(uid, link);
  }
  console.log(`Loaded ${facebookLinkByUid.size} client_accounts records with a non-empty facebook_link.`);

  const borrowers = await prisma.borrower.findMany({
    where: { legacyId: { not: null }, facebookLink: null },
    select: { id: true, legacyId: true, firstName: true, lastName: true },
  });
  console.log(`Found ${borrowers.length} migrated borrowers with no facebookLink yet.`);

  let updated = 0;
  let noSourceLink = 0;

  for (const b of borrowers) {
    const link = facebookLinkByUid.get(b.legacyId!);
    if (!link) {
      noSourceLink++;
      continue;
    }
    if (APPLY) {
      await prisma.borrower.update({ where: { id: b.id }, data: { facebookLink: link } });
    }
    updated++;
  }

  console.log('');
  console.log(`${APPLY ? 'Updated' : 'Would update'}: ${updated}`);
  console.log(`Skipped (no facebook_link in source for this client): ${noSourceLink}`);
  if (!APPLY) {
    console.log('\nDry run only - no writes made. Re-run with --apply to write these values.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
