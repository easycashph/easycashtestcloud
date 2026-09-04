/**
 * Follow-up to backfill-psgc-code-addresses-to-names.ts (2026-09-04): that script left 124 rows
 * unresolved because their `barangay` value wasn't a full PSGC code, just a short number (e.g. "176",
 * "36") - Metro Manila's own barangay-numbering convention rather than a name (many Manila-area
 * barangays literally have no name other than "Barangay 176", etc). All 124 rows have a
 * `cityMunicipality` that's already a real place name, not a code.
 *
 * Resolution: look up the borrower's own `cityMunicipality` name in `psgc_city_municipalities`
 * (case-insensitive exact match), then find that city's barangay whose PSGC name is literally
 * "Barangay {number}" - confirmed directly (e.g. barangay "176" under "Caloocan City" resolves to
 * PSGC code 137501176, name "Barangay 176"). Only writes when both the city match and the
 * "Barangay {number}" match are unambiguous; anything else is left untouched and reported.
 *
 * Usage:
 *   npx tsx scripts/backfill-numbered-barangay-addresses.ts          # dry run
 *   npx tsx scripts/backfill-numbered-barangay-addresses.ts --apply  # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const NUMERIC = /^\d+$/;

async function main(): Promise<void> {
  console.log(`=== Numbered-barangay address backfill (${APPLY ? 'APPLY' : 'dry run'}) ===`);

  const addresses = await prisma.address.findMany({
    where: { ownerType: 'BORROWER', barangay: { not: null } },
  });
  const candidates = addresses.filter((a) => a.barangay && NUMERIC.test(a.barangay) && a.cityMunicipality && !NUMERIC.test(a.cityMunicipality));
  console.log(`${candidates.length} address row(s) with a numbered barangay and a real city name.`);

  const cities = await prisma.psgcCityMunicipality.findMany();
  const barangays = await prisma.psgcBarangay.findMany();
  const cityCodeByLowerName = new Map(cities.map((c) => [c.name.toLowerCase(), c.code]));
  const barangayNameByCityAndNumber = new Map<string, string>();
  for (const b of barangays) {
    const match = /^Barangay (\d+)$/i.exec(b.name);
    if (match) barangayNameByCityAndNumber.set(`${b.cityMunicipalityCode}:${Number(match[1])}`, b.name);
  }

  let fixed = 0;
  let unresolved = 0;
  const unresolvedRows: { id: string; city: string; barangay: string }[] = [];

  for (const addr of candidates) {
    const cityCode = cityCodeByLowerName.get(addr.cityMunicipality!.toLowerCase());
    const resolvedName = cityCode ? barangayNameByCityAndNumber.get(`${cityCode}:${Number(addr.barangay)}`) : undefined;

    if (!resolvedName) {
      unresolved++;
      unresolvedRows.push({ id: addr.id, city: addr.cityMunicipality!, barangay: addr.barangay! });
      continue;
    }

    fixed++;
    console.log(`  ${addr.id}: barangay ${addr.barangay} (${addr.cityMunicipality}) -> ${resolvedName}`);
    if (APPLY) {
      await prisma.address.update({ where: { id: addr.id }, data: { barangay: resolvedName } });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Fixed (${APPLY ? 'written' : 'would write'}): ${fixed}`);
  console.log(`Unresolved (no matching "Barangay N" under that city - left untouched): ${unresolved}`);
  if (unresolvedRows.length > 0) {
    console.log('\nUnresolved rows:');
    for (const r of unresolvedRows.slice(0, 30)) console.log(`  ${r.id} city=${r.city} barangay=${r.barangay}`);
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
