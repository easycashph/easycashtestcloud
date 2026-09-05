/**
 * Second follow-up to backfill-psgc-code-addresses-to-names.ts / backfill-numbered-barangay-
 * addresses.ts (2026-09-05): after that pair fixed 99 of 122 numbered-barangay rows, 14 of the
 * remaining 23 turned out to still be resolvable - `backfill-numbered-barangay-addresses.ts`'s
 * plain `cityMunicipality.toLowerCase()` exact-match lookup missed them for two reasons, both
 * confirmed directly against the PSGC tables before writing this:
 *
 *   1. Duplicate city/district names across provinces (e.g. "SANTA ANA" exists in NCR/Manila AND
 *      two other provinces; "SANTA CRUZ" exists in six). A plain `Map<name, code>` can only hold
 *      one code per name, so whichever province happened to load last silently won - even though
 *      the correct Manila-district barangay (e.g. "Barangay 897" under NCR's Santa Ana) genuinely
 *      exists in the data. Fix: when a city name matches more than one PSGC row, prefer the one
 *      whose province name contains "NCR" (Easycash's own borrower base is Metro Manila) - only
 *      when that narrows it to exactly one candidate; otherwise leave unresolved rather than guess.
 *   2. A `cityMunicipality` value carrying an extra qualifier the PSGC table's plain name doesn't
 *      have (e.g. "Pandacan, City Of Manila", "Caloocan City, NCR", "Sampaloc, Metro Manila") -
 *      fix: strip a trailing ", City Of Manila" / ", NCR" / ", Metro Manila" (or the same without
 *      the leading comma) before the exact-match lookup, then apply the same NCR-preference rule
 *      above if that still leaves duplicates.
 *
 * The remaining 9 rows this script still can't resolve are genuine PSGC data gaps, not lookup
 * bugs - the referenced barangay number is out of that district's actual range (e.g. Malate only
 * goes up to Barangay 744, one address needs "179") or a mis-transcribed old-Manila-district
 * abbreviation ("Sta Cruz Manila" vs the PSGC table's "Santa Cruz", itself also short of the
 * needed number) - confirmed by direct range checks, not left unresolved out of caution alone.
 *
 * Usage:
 *   npx tsx scripts/backfill-numbered-barangay-addresses-ncr-fallback.ts          # dry run
 *   npx tsx scripts/backfill-numbered-barangay-addresses-ncr-fallback.ts --apply  # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const NUMERIC = /^\d+$/;
const SUFFIX_RE = /,?\s*(city of manila|ncr|metro manila)\s*$/i;

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

async function main(): Promise<void> {
  console.log(`=== Numbered-barangay address backfill, NCR-preference fallback (${APPLY ? 'APPLY' : 'dry run'}) ===`);

  const addresses = await prisma.address.findMany({
    where: { ownerType: 'BORROWER', barangay: { not: null } },
  });
  const candidates = addresses.filter(
    (a) => a.barangay && NUMERIC.test(a.barangay) && a.cityMunicipality && !NUMERIC.test(a.cityMunicipality),
  );
  console.log(`${candidates.length} address row(s) with a numbered barangay and a real city name.`);

  const cities = await prisma.psgcCityMunicipality.findMany({ include: { province: true } });
  const barangays = await prisma.psgcBarangay.findMany();

  // Group PSGC cities by normalized name - may hold more than one candidate per name.
  const citiesByName = new Map<string, { code: string; provinceName: string }[]>();
  for (const c of cities) {
    const key = normalize(c.name);
    const list = citiesByName.get(key) ?? [];
    list.push({ code: c.code, provinceName: c.province.name });
    citiesByName.set(key, list);
  }

  const barangayNameByCityAndNumber = new Map<string, string>();
  for (const b of barangays) {
    const match = /^Barangay (\d+)$/i.exec(b.name);
    if (match) barangayNameByCityAndNumber.set(`${b.cityMunicipalityCode}:${Number(match[1])}`, b.name);
  }

  function resolveCityCode(rawName: string): { code: string; reason: string } | null {
    const tried = [normalize(rawName), normalize(rawName.replace(SUFFIX_RE, ''))];
    for (const key of tried) {
      const matches = citiesByName.get(key);
      if (!matches || matches.length === 0) continue;
      if (matches.length === 1) return { code: matches[0]!.code, reason: 'exact match' };
      const ncrMatches = matches.filter((m) => m.provinceName.includes('NCR'));
      if (ncrMatches.length === 1) return { code: ncrMatches[0]!.code, reason: 'NCR-preferred among duplicates' };
      return null; // still ambiguous even after NCR preference - do not guess
    }
    return null;
  }

  let fixed = 0;
  let unresolved = 0;
  const unresolvedRows: { id: string; city: string; barangay: string }[] = [];

  for (const addr of candidates) {
    const resolved = resolveCityCode(addr.cityMunicipality!);
    const resolvedName = resolved ? barangayNameByCityAndNumber.get(`${resolved.code}:${Number(addr.barangay)}`) : undefined;

    if (!resolvedName) {
      unresolved++;
      unresolvedRows.push({ id: addr.id, city: addr.cityMunicipality!, barangay: addr.barangay! });
      continue;
    }

    fixed++;
    console.log(`  ${addr.id}: barangay ${addr.barangay} (${addr.cityMunicipality}) -> ${resolvedName} [${resolved!.reason}]`);
    if (APPLY) {
      await prisma.address.update({ where: { id: addr.id }, data: { barangay: resolvedName } });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Fixed (${APPLY ? 'written' : 'would write'}): ${fixed}`);
  console.log(`Unresolved (left untouched - genuine PSGC data gap, not a lookup miss): ${unresolved}`);
  if (unresolvedRows.length > 0) {
    console.log('\nUnresolved rows:');
    for (const r of unresolvedRows) console.log(`  ${r.id} city=${r.city} barangay=${r.barangay}`);
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
