/* eslint-disable no-console */
/**
 * 2026-09-14 (Agency name dropdown, user request): one-time import of DMW's live licensed
 * recruitment agencies directory (dmw.gov.ph/licensed-recruitment-agencies) into the new
 * LicensedRecruitmentAgency table. Source data (scripts/data/dmw-licensed-agencies-2026-09-14.json)
 * was captured via in-browser automation (paging through the site's own table, 76 pages × 50 rows,
 * reading rendered DOM content directly - not a download, since no public API or bulk-export
 * endpoint exists for this list) - real, complete data, not invented or sampled. Idempotent: wipes
 * and re-inserts every run (there's no natural external key to upsert against - DMW's own
 * "licenseNumber" column was blank/"N/A" for every row at capture time), safe to re-run after a
 * future re-capture of the same source.
 *
 * Usage:
 *   npx tsx scripts/scratch-import-dmw-agencies.ts            # dry run
 *   npx tsx scripts/scratch-import-dmw-agencies.ts --apply    # writes
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const DATA_FILE = path.join(__dirname, 'data', 'dmw-licensed-agencies-2026-09-14.json');

interface RawAgency {
  name: string;
  address: string;
  contactName: string;
  phone: string;
  licenseNumber: string;
  status: string;
}

async function main(): Promise<void> {
  console.log(`Import DMW licensed agencies — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const raw: RawAgency[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`Loaded ${raw.length} agencies from ${path.basename(DATA_FILE)}`);

  const statusCounts = new Map<string, number>();
  for (const a of raw) statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
  console.log('Status breakdown:');
  for (const [status, count] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count}`);
  }

  if (APPLY) {
    const existing = await prisma.licensedRecruitmentAgency.count();
    if (existing > 0) {
      console.log(`Clearing ${existing} existing row(s) before re-import...`);
      await prisma.licensedRecruitmentAgency.deleteMany({});
    }
    await prisma.licensedRecruitmentAgency.createMany({
      data: raw.map((a) => ({
        name: a.name,
        address: a.address || null,
        contactName: a.contactName || null,
        phone: a.phone || null,
        licenseNumber: a.licenseNumber && a.licenseNumber !== 'N/A' ? a.licenseNumber : null,
        status: a.status,
      })),
    });
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${raw.length} agencies ${APPLY ? 'imported' : 'would be imported'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
