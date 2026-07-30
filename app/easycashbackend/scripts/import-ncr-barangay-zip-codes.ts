/* eslint-disable no-console */
/**
 * Backfills `PsgcBarangay.zipCode` for NCR from the same third-party reference list used by
 * `import-ph-zip-codes.ts` (`scripts/reference-data/ph-zip-codes.yml`, © 2012 Nadarei Co, MIT
 * licensed, carries its own "FIXME: proofread!" caveat). A single city-level ZIP doesn't work for
 * Metro Manila - a city like Makati genuinely has 30+ ZIP codes depending on barangay - so
 * `PsgcCityMunicipality.zipCode` stays null across NCR and this script fills the barangay-level
 * column instead (see prisma/schema.prisma's `PsgcBarangay.zipCode` doc comment).
 *
 * The yml's "Metro Manila" block is nested one level deeper than every other province (city ->
 * barangay/area -> zip, instead of city -> zip), and the district-level entries for Manila itself
 * (Manila is split into ~13 separate PSGC "city" rows - Binondo, Ermita, Tondo I/II, etc. - not one
 * "Manila" city with barangays) are handled specially: those items are matched against
 * PsgcCityMunicipality, not PsgcBarangay.
 *
 * Some yml entries name more than one real barangay sharing a ZIP (e.g. "La Paz, Singkamas, and
 * Tejeros: 1204") - each fragment is matched independently. Never invents a match: an item is only
 * written if its (or, for combined entries, its fragment's) normalized name matches exactly one
 * barangay in the target city. No match, or more than one, is skipped and reported - same
 * never-fabricate policy as import-ph-zip-codes.ts.
 *
 * Usage:
 *   npx tsx scripts/import-ncr-barangay-zip-codes.ts            # dry run - reports counts, writes nothing
 *   npx tsx scripts/import-ncr-barangay-zip-codes.ts --apply    # actually writes to the configured DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const YAML_PATH = path.resolve(__dirname, 'reference-data/ph-zip-codes.yml');
const NCR_REGION_CODE = '13';

interface RawItem {
  cityBucket: string;
  item: string;
  zipCode: string;
}

/** Extracts just the "Metro Manila:" block (city -> item -> zip, 2/4-space indented) - every other
 * province in the file is only 2 levels deep (province -> city -> zip), so this needs its own
 * purpose-built parse rather than reusing import-ph-zip-codes.ts's parser. */
function parseMetroManilaBlock(text: string): RawItem[] {
  const lines = text.split('\n');
  const startIndex = lines.findIndex((l) => l.trim() === 'Metro Manila:');
  if (startIndex === -1) throw new Error('"Metro Manila:" block not found in reference yml.');
  const items: RawItem[] = [];
  let cityBucket: string | null = null;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i]!.replace(/\s+$/, '');
    if (!line.trim()) continue;
    if (!line.startsWith(' ')) break; // next top-level province - end of the Metro Manila block
    const cityMatch = line.match(/^ {2}([^:]+):\s*$/);
    if (cityMatch) {
      cityBucket = cityMatch[1]!.trim();
      continue;
    }
    const itemMatch = line.match(/^\s+(.+?):\s*(\d{4})\s*$/); // skips malformed zips like "14??"
    if (itemMatch && cityBucket) {
      items.push({ cityBucket, item: itemMatch[1]!.trim(), zipCode: itemMatch[2]! });
    }
  }
  return items;
}

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\([^)]*\)/g, '') // drop parenthetical notes, e.g. "(now part of Taguig)"
    .replace(/[.\-ñÑ]/g, (c) => (c === 'ñ' || c === 'Ñ' ? 'N' : ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^CITY OF\s+/, '')
    .replace(/\s+CITY$/, '')
    .trim();
}

/** Splits a combined entry like "La Paz, Singkamas, and Tejeros" into its individual real-place
 * fragments - each is matched independently against the barangay/city list. */
function splitFragments(item: string): string[] {
  return item
    .split(',')
    .flatMap((part) => part.split(/\s+and\s+/i))
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const yamlText = fs.readFileSync(YAML_PATH, 'utf-8');
  const rawItems = parseMetroManilaBlock(yamlText);
  console.log(`Parsed ${rawItems.length} city/item/zip entries from the Metro Manila block.`);

  const ncrCities = await prisma.psgcCityMunicipality.findMany({
    where: { province: { regionCode: NCR_REGION_CODE } },
    select: { code: true, name: true },
  });
  const cityCodeByNorm = new Map<string, { code: string; name: string }[]>();
  for (const c of ncrCities) {
    const key = normalizeName(c.name);
    const arr = cityCodeByNorm.get(key) ?? [];
    arr.push(c);
    cityCodeByNorm.set(key, arr);
  }

  const barangaysByCityCode = new Map<string, { code: string; name: string }[]>();
  for (const c of ncrCities) {
    barangaysByCityCode.set(
      c.code,
      await prisma.psgcBarangay.findMany({ where: { cityMunicipalityCode: c.code }, select: { code: true, name: true } }),
    );
  }

  const barangayUpdates: { code: string; zipCode: string }[] = [];
  const cityUpdates: { code: string; zipCode: string }[] = [];
  let matched = 0;
  let skippedNoMatch = 0;
  let skippedAmbiguous = 0;
  const skippedExamples: string[] = [];

  for (const raw of rawItems) {
    const bucketCity = (cityCodeByNorm.get(normalizeName(raw.cityBucket)) ?? [])[0];

    for (const fragment of splitFragments(raw.item)) {
      const fragKey = normalizeName(fragment);
      if (!fragKey) continue;

      if (bucketCity) {
        // Normal case: bucket is a real NCR city (Caloocan, Makati, ...) - match against its barangays.
        const candidates = (barangaysByCityCode.get(bucketCity.code) ?? []).filter((b) => normalizeName(b.name) === fragKey);
        if (candidates.length === 1) {
          barangayUpdates.push({ code: candidates[0]!.code, zipCode: raw.zipCode });
          matched++;
        } else if (candidates.length === 0) {
          skippedNoMatch++;
          if (skippedExamples.length < 30) skippedExamples.push(`${raw.cityBucket} | ${fragment}`);
        } else {
          skippedAmbiguous++;
        }
      } else {
        // "Manila" bucket - Manila is split into ~13 separate city-level PSGC rows, not barangays
        // under one "Manila" city - match the fragment directly against those city rows instead.
        const candidates = cityCodeByNorm.get(fragKey) ?? [];
        if (candidates.length === 1) {
          cityUpdates.push({ code: candidates[0]!.code, zipCode: raw.zipCode });
          matched++;
        } else if (candidates.length === 0) {
          skippedNoMatch++;
          if (skippedExamples.length < 30) skippedExamples.push(`${raw.cityBucket} | ${fragment}`);
        } else {
          skippedAmbiguous++;
        }
      }
    }
  }

  console.log(`\n=== Reconciliation ===`);
  console.log(`matched (will update): ${matched} (${barangayUpdates.length} barangays, ${cityUpdates.length} Manila districts)`);
  console.log(`skipped (no match): ${skippedNoMatch}`);
  console.log(`skipped (ambiguous - multiple candidates): ${skippedAmbiguous}`);
  console.log(`\nSample of skipped (first 30):\n${skippedExamples.join('\n')}`);

  if (!APPLY) {
    console.log('\nDry run complete - no data was written. Re-run with --apply to write to the database.');
    await prisma.$disconnect();
    return;
  }

  for (const u of barangayUpdates) {
    await prisma.psgcBarangay.update({ where: { code: u.code }, data: { zipCode: u.zipCode } });
  }
  for (const u of cityUpdates) {
    await prisma.psgcCityMunicipality.update({ where: { code: u.code }, data: { zipCode: u.zipCode } });
  }
  console.log(`\nApplied: ${barangayUpdates.length} barangay zipCode values + ${cityUpdates.length} Manila district zipCode values written.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
