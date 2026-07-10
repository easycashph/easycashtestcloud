/**
 * One-time, idempotent fix for `addresses` rows whose `barangay`/`cityMunicipality`/`province`
 * columns were migrated verbatim from the legacy export as raw PSGC codes (e.g. barangay
 * "137404005") instead of names — a real data-quality split in the legacy source itself: ~65% of
 * legacy address records (830/1,274) stored codes, the rest stored names directly. Confirmed by
 * direct inspection, not assumed (see docs/Architecture/CP12-legacy-migration-report.md and the
 * 2026-07-09 follow-up conversation).
 *
 * Resolves codes to names using the legacy `db-address-api` MongoDB export's own
 * barangays/citymunicipalities/provinces lookup tables (read-only, never modified) — the same
 * source of truth the legacy system itself used. Never invents a name for a code that doesn't
 * resolve; such rows are left untouched and counted in the summary, not guessed.
 *
 * Usage: npx tsx scripts/resolve-address-codes.ts [--dry-run]
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';

const API_DIR = path.resolve(
  __dirname,
  '../../../legacy/MongoDB dump/extracted/07092026_ 92543/db-address-api',
);
const DRY_RUN = process.argv.includes('--dry-run');
const NUMERIC = /^\d+$/;

function readAll<T = any>(file: string): T[] {
  const buf = fs.readFileSync(path.join(API_DIR, file));
  let offset = 0;
  const docs: T[] = [];
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    docs.push(BSON.deserialize(buf.subarray(offset, offset + size), { promoteValues: true }) as T);
    offset += size;
  }
  return docs;
}

async function main(): Promise<void> {
  console.log(`=== Address code resolution ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const barangayByCode = new Map<string, string>();
  for (const b of readAll<{ brgyCode: string; brgyDesc: string }>('barangays.bson')) {
    barangayByCode.set(b.brgyCode, b.brgyDesc);
  }
  const citymunByCode = new Map<string, string>();
  for (const c of readAll<{ citymunCode: string; citymunDesc: string }>('citymunicipalities.bson')) {
    citymunByCode.set(c.citymunCode, c.citymunDesc);
  }
  const provinceByCode = new Map<string, string>();
  for (const p of readAll<{ provCode: string; provDesc: string }>('provinces.bson')) {
    provinceByCode.set(p.provCode, p.provDesc);
  }
  console.log(`Lookup tables loaded: ${barangayByCode.size} barangays, ${citymunByCode.size} cities/municipalities, ${provinceByCode.size} provinces`);

  const addresses = await prisma.address.findMany();
  let updated = 0, unresolved = 0, alreadyText = 0;

  for (const a of addresses) {
    const barangayIsCode = a.barangay ? NUMERIC.test(a.barangay) : false;
    const cityIsCode = a.cityMunicipality ? NUMERIC.test(a.cityMunicipality) : false;
    const provinceIsCode = a.province ? NUMERIC.test(a.province) : false;

    if (!barangayIsCode && !cityIsCode && !provinceIsCode) {
      alreadyText++;
      continue;
    }

    const resolvedBarangay = barangayIsCode ? barangayByCode.get(a.barangay!) : a.barangay;
    const resolvedCity = cityIsCode ? citymunByCode.get(a.cityMunicipality!) : a.cityMunicipality;
    const resolvedProvince = provinceIsCode ? provinceByCode.get(a.province!) : a.province;

    const stillUnresolved =
      (barangayIsCode && !resolvedBarangay) || (cityIsCode && !resolvedCity) || (provinceIsCode && !resolvedProvince);
    if (stillUnresolved) {
      unresolved++;
      console.log(`  UNRESOLVED id=${a.id}: barangay="${a.barangay}" city="${a.cityMunicipality}" province="${a.province}"`);
      continue;
    }

    if (!DRY_RUN) {
      await prisma.address.update({
        where: { id: a.id },
        data: {
          barangay: resolvedBarangay ?? a.barangay,
          cityMunicipality: resolvedCity ?? a.cityMunicipality,
          province: resolvedProvince ?? a.province,
        },
      });
    }
    updated++;
  }

  console.log('\n=== Summary ===');
  console.log(`Total addresses: ${addresses.length}`);
  console.log(`Already text (untouched): ${alreadyText}`);
  console.log(`Resolved and updated: ${updated}`);
  console.log(`Unresolved (code not found in lookup tables, left as-is): ${unresolved}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
