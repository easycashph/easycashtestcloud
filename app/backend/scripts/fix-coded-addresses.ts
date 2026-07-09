/* eslint-disable no-console */
/**
 * One-time data fix: ~68% of migrated `Address` rows (CP12) have `province`/`cityMunicipality`/
 * `barangay` stored as raw PSGC codes (e.g. province "1375", city "137504", barangay "137504011")
 * instead of names — the legacy system apparently had two address-entry paths (a PSGC-code picker
 * and free text), and CP12 copied whichever the source record had verbatim. See
 * scripts/import-psgc-reference-data.ts (run first — this script depends on those lookup tables
 * already being populated).
 *
 * Detects a "coded" field by pattern: province is exactly 4 digits, cityMunicipality exactly 6
 * digits, barangay exactly 9 digits (PSGC's fixed-width code format) — matching how the reference
 * tables' own `code` columns are shaped. A field is only rewritten if its code resolves to a real
 * PSGC row; unresolvable codes are left untouched and reported, never guessed at (CLAUDE.md "never
 * fabricate").
 *
 * Idempotent: already-decoded (non-numeric) fields don't match the code pattern, so re-running is
 * always safe.
 *
 * Usage:
 *   npx tsx scripts/fix-coded-addresses.ts            # dry run — reports what would change
 *   npx tsx scripts/fix-coded-addresses.ts --apply     # actually writes to the configured DATABASE_URL
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

const PROVINCE_CODE = /^\d{4}$/;
const CITY_CODE = /^\d{6}$/;
const BARANGAY_CODE = /^\d{9}$/;

async function main(): Promise<void> {
  const addresses = await prisma.address.findMany({
    where: {
      OR: [{ province: { not: null } }, { cityMunicipality: { not: null } }, { barangay: { not: null } }],
    },
  });

  const provinceByCode = new Map((await prisma.psgcProvince.findMany()).map((p) => [p.code, p.name]));
  const cityByCode = new Map((await prisma.psgcCityMunicipality.findMany()).map((c) => [c.code, c.name]));
  const barangayByCode = new Map((await prisma.psgcBarangay.findMany()).map((b) => [b.code, b.name]));

  let toUpdate = 0;
  let unresolvedProvince = 0;
  let unresolvedCity = 0;
  let unresolvedBarangay = 0;
  const updates: { id: string; province?: string; cityMunicipality?: string; barangay?: string }[] = [];

  for (const addr of addresses) {
    const patch: { province?: string; cityMunicipality?: string; barangay?: string } = {};

    if (addr.province && PROVINCE_CODE.test(addr.province)) {
      const name = provinceByCode.get(addr.province);
      if (name) patch.province = name;
      else unresolvedProvince += 1;
    }
    if (addr.cityMunicipality && CITY_CODE.test(addr.cityMunicipality)) {
      const name = cityByCode.get(addr.cityMunicipality);
      if (name) patch.cityMunicipality = name;
      else unresolvedCity += 1;
    }
    if (addr.barangay && BARANGAY_CODE.test(addr.barangay)) {
      const name = barangayByCode.get(addr.barangay);
      if (name) patch.barangay = name;
      else unresolvedBarangay += 1;
    }

    if (Object.keys(patch).length > 0) {
      toUpdate += 1;
      updates.push({ id: addr.id, ...patch });
    }
  }

  console.log(`Scanned ${addresses.length} addresses.`);
  console.log(`  ${toUpdate} rows have at least one resolvable coded field.`);
  if (unresolvedProvince || unresolvedCity || unresolvedBarangay) {
    console.log(
      `  Unresolvable (code-shaped but not found in PSGC tables) — left untouched: ${unresolvedProvince} province, ${unresolvedCity} city, ${unresolvedBarangay} barangay.`,
    );
  }
  console.log('Sample of first 5 changes:');
  for (const u of updates.slice(0, 5)) {
    console.log(`  ${u.id}:`, { province: u.province, cityMunicipality: u.cityMunicipality, barangay: u.barangay });
  }

  if (!APPLY) {
    console.log('\nDry run only — pass --apply to write. Nothing was written.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nApplying...');
  for (const u of updates) {
    await prisma.address.update({
      where: { id: u.id },
      data: {
        ...(u.province ? { province: u.province } : {}),
        ...(u.cityMunicipality ? { cityMunicipality: u.cityMunicipality } : {}),
        ...(u.barangay ? { barangay: u.barangay } : {}),
      },
    });
  }
  console.log(`Updated ${updates.length} rows.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
