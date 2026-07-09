/* eslint-disable no-console */
/**
 * Imports the PSGC (Philippine Standard Geographic Code) reference tables — regions, provinces,
 * cities/municipalities, barangays — from the legacy `db-address-api` Mongo dump into Postgres.
 *
 * That legacy Mongo database backed an address-autocomplete microservice in the old system and was
 * never migrated during CP12 (which only covered `db-easycash`). It's needed now to decode the raw
 * PSGC codes some legacy borrower addresses were stored as (see scripts/fix-coded-addresses.ts) and,
 * going forward, to back a real cascading address picker instead of free-text entry.
 *
 * Never connects to a live MongoDB, never writes back to the dump (CLAUDE.md's "never modify legacy
 * data during migration"). Idempotent: every row upserts on its PSGC code, so re-running this script
 * is always safe.
 *
 * Usage:
 *   npx tsx scripts/import-psgc-reference-data.ts            # dry run — reports counts, writes nothing
 *   npx tsx scripts/import-psgc-reference-data.ts --apply    # actually writes to the configured DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const DUMP_DIR = path.resolve(__dirname, '../../../legacy/mongodb/07012026_103239/db-address-api');

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

interface RegionDoc {
  regCode: string;
  regDesc: string;
}
interface ProvinceDoc {
  provCode: string;
  provDesc: string;
  regCode: string;
}
interface CityMunDoc {
  citymunCode: string;
  citymunDesc: string;
  provCode: string;
}
interface BarangayDoc {
  brgyCode: string;
  brgyDesc: string;
  citymunCode: string;
}

async function main(): Promise<void> {
  const regions = loadAll<RegionDoc>('regions');
  const provinces = loadAll<ProvinceDoc>('provinces');
  const cities = loadAll<CityMunDoc>('citymunicipalities');
  const barangays = loadAll<BarangayDoc>('barangays');

  console.log(`Loaded from dump: ${regions.length} regions, ${provinces.length} provinces, ${cities.length} cities/municipalities, ${barangays.length} barangays.`);

  // Cross-reference integrity check before writing anything — a province pointing at a region code
  // that doesn't exist (or similar) would violate the FK constraints below and abort the whole run
  // partway through if not caught first.
  const regionCodes = new Set(regions.map((r) => r.regCode));
  const provinceCodes = new Set(provinces.map((p) => p.provCode));
  const cityCodes = new Set(cities.map((c) => c.citymunCode));
  const orphanedProvinces = provinces.filter((p) => !regionCodes.has(p.regCode));
  const orphanedCities = cities.filter((c) => !provinceCodes.has(c.provCode));
  const orphanedBarangays = barangays.filter((b) => !cityCodes.has(b.citymunCode));
  if (orphanedProvinces.length > 0) console.log(`  ${orphanedProvinces.length} provinces reference an unknown region — skipping those.`);
  if (orphanedCities.length > 0) console.log(`  ${orphanedCities.length} cities reference an unknown province — skipping those.`);
  if (orphanedBarangays.length > 0) console.log(`  ${orphanedBarangays.length} barangays reference an unknown city — skipping those.`);

  if (!APPLY) {
    console.log('\nDry run only — pass --apply to write. Nothing was written.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nApplying...');

  // Batched createMany + skipDuplicates rather than row-by-row upsert-in-a-transaction: this table
  // is static reference data (42k+ barangay rows), so a plain "insert if new, leave existing alone"
  // is both correct and far faster than 42k individual round-trips inside one long-lived
  // interactive transaction (which was timing out at 120s).
  const CHUNK_SIZE = 5000;
  async function insertInChunks<T>(label: string, rows: T[], insert: (chunk: T[]) => Promise<{ count: number }>): Promise<void> {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const result = await insert(chunk);
      inserted += result.count;
    }
    console.log(`  ${label}: ${inserted} newly inserted (${rows.length - inserted} already present)`);
  }

  await insertInChunks('regions', regions, (chunk) =>
    prisma.psgcRegion.createMany({ data: chunk.map((r) => ({ code: r.regCode, name: r.regDesc })), skipDuplicates: true }),
  );
  await insertInChunks(
    'provinces',
    provinces.filter((p) => regionCodes.has(p.regCode)),
    (chunk) =>
      prisma.psgcProvince.createMany({
        data: chunk.map((p) => ({ code: p.provCode, name: p.provDesc, regionCode: p.regCode })),
        skipDuplicates: true,
      }),
  );
  await insertInChunks(
    'cities/municipalities',
    cities.filter((c) => provinceCodes.has(c.provCode)),
    (chunk) =>
      prisma.psgcCityMunicipality.createMany({
        data: chunk.map((c) => ({ code: c.citymunCode, name: c.citymunDesc, provinceCode: c.provCode })),
        skipDuplicates: true,
      }),
  );
  await insertInChunks(
    'barangays',
    barangays.filter((b) => cityCodes.has(b.citymunCode)),
    (chunk) =>
      prisma.psgcBarangay.createMany({
        data: chunk.map((b) => ({ code: b.brgyCode, name: b.brgyDesc, cityMunicipalityCode: b.citymunCode })),
        skipDuplicates: true,
      }),
  );

  console.log('\nDone.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
