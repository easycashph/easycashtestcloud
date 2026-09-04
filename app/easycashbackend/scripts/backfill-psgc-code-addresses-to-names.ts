/**
 * One-time backfill (2026-09-04, found via a real data-quality bug spotted in the CIC Monthly
 * Report Excel export): `backfill-mambu-customfield-addresses.ts` copied Mambu's `hm_addr_*`
 * custom-field values into `addresses.barangay`/`.cityMunicipality`/`.province` verbatim - for a
 * real subset of borrowers, Mambu had those fields storing raw PSGC (Philippine Standard
 * Geographic Code) numbers instead of place names, so this LMS ended up with the same numeric
 * codes sitting where a place name belongs (confirmed: 630 `addresses` rows on this machine have a
 * purely-numeric `barangay` and/or `cityMunicipality` and/or `province`).
 *
 * This system already has a fully-populated PSGC reference (`psgc_regions`/`psgc_provinces`/
 * `psgc_city_municipalities`/`psgc_barangays`, code -> name) - built for the address picker's
 * autocomplete, not previously connected to this cleanup. Every numeric code checked resolves
 * cleanly to a real name (verified directly: 1339 -> "NCR, CITY OF MANILA, FIRST DISTRICT",
 * 133906 -> "SAMPALOC", 133906173 -> "Barangay 567").
 *
 * Only touches a field that is PURELY numeric (matches `^\d+$`) AND resolves to a real PSGC row -
 * never guesses, never touches a field that already holds a real name, and leaves a numeric value
 * untouched (flagged) if it doesn't match any PSGC code on file.
 *
 * Usage:
 *   npx tsx scripts/backfill-psgc-code-addresses-to-names.ts          # dry run - reports only
 *   npx tsx scripts/backfill-psgc-code-addresses-to-names.ts --apply  # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const NUMERIC = /^\d+$/;

async function main(): Promise<void> {
  console.log(`=== PSGC-code-as-name address backfill (${APPLY ? 'APPLY' : 'dry run'}) ===`);

  const addresses = await prisma.address.findMany({
    where: {
      OR: [{ barangay: { not: null } }, { cityMunicipality: { not: null } }, { province: { not: null } }],
    },
  });

  const candidates = addresses.filter(
    (a) =>
      (a.barangay && NUMERIC.test(a.barangay)) ||
      (a.cityMunicipality && NUMERIC.test(a.cityMunicipality)) ||
      (a.province && NUMERIC.test(a.province)),
  );
  console.log(`${candidates.length} address row(s) with at least one purely-numeric field.`);

  const [provinces, cities, barangays] = await Promise.all([
    prisma.psgcProvince.findMany(),
    prisma.psgcCityMunicipality.findMany(),
    prisma.psgcBarangay.findMany(),
  ]);
  const provinceByCode = new Map(provinces.map((p) => [p.code, p.name]));
  const cityByCode = new Map(cities.map((c) => [c.code, c.name]));
  const barangayByCode = new Map(barangays.map((b) => [b.code, b.name]));

  let fixed = 0;
  let unresolved = 0;
  const unresolvedRows: { id: string; field: string; value: string }[] = [];

  for (const addr of candidates) {
    const update: Record<string, string> = {};

    if (addr.province && NUMERIC.test(addr.province)) {
      const name = provinceByCode.get(addr.province);
      if (name) update.province = name;
      else {
        unresolved++;
        unresolvedRows.push({ id: addr.id, field: 'province', value: addr.province });
      }
    }
    if (addr.cityMunicipality && NUMERIC.test(addr.cityMunicipality)) {
      const name = cityByCode.get(addr.cityMunicipality);
      if (name) update.cityMunicipality = name;
      else {
        unresolved++;
        unresolvedRows.push({ id: addr.id, field: 'cityMunicipality', value: addr.cityMunicipality });
      }
    }
    if (addr.barangay && NUMERIC.test(addr.barangay)) {
      const name = barangayByCode.get(addr.barangay);
      if (name) update.barangay = name;
      else {
        unresolved++;
        unresolvedRows.push({ id: addr.id, field: 'barangay', value: addr.barangay });
      }
    }

    if (Object.keys(update).length === 0) continue;

    fixed++;
    console.log(`  ${addr.id}: ${JSON.stringify(update)}`);
    if (APPLY) {
      await prisma.address.update({ where: { id: addr.id }, data: update });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Fixed (code resolved to a real PSGC name, ${APPLY ? 'written' : 'would write'}): ${fixed}`);
  console.log(`Unresolved (numeric value not found in PSGC tables - left untouched, needs manual review): ${unresolved}`);
  if (unresolvedRows.length > 0) {
    console.log('\nUnresolved rows:');
    for (const r of unresolvedRows.slice(0, 30)) console.log(`  ${r.id} ${r.field}=${r.value}`);
    if (unresolvedRows.length > 30) console.log(`  ... and ${unresolvedRows.length - 30} more`);
  }

  if (!APPLY) console.log('\nDry run only - re-run with --apply to write these changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
