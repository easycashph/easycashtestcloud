/* eslint-disable no-console */
/**
 * Backfills `PsgcCityMunicipality.zipCode` from a third-party reference list
 * (`scripts/reference-data/ph-zip-codes.yml`, sourced from
 * https://github.com/nadarei/philippines - MIT licensed, © 2012 Nadarei Co. That file itself
 * carries a "FIXME: proofread!" caveat from its own maintainer, so this is a best-effort backfill,
 * not an authoritative source - it exists only to auto-fill the address picker's ZIP Code field as
 * a starting suggestion; the field stays a plain editable Input afterward.
 *
 * Never invents a zip code: a city/municipality only gets one written if its name matches exactly
 * one row in our own `psgc_city_municipalities` table (scoped to the matching province, to avoid
 * cross-province name collisions) after normalizing away formatting differences between the two
 * datasets (parenthetical notes like "(Capital)"/"(San Pedro)", and "CITY OF X" vs "X CITY"
 * phrasing - see `normalizeCityName()`). No match, or more than one, is skipped and reported, not
 * guessed - matches CLAUDE.md's "never fabricate" for the migration scripts in this repo.
 *
 * Usage:
 *   npx tsx scripts/import-ph-zip-codes.ts            # dry run - reports counts, writes nothing
 *   npx tsx scripts/import-ph-zip-codes.ts --apply     # actually writes to the configured DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const YAML_PATH = path.resolve(__dirname, 'reference-data/ph-zip-codes.yml');

interface ZipEntry {
  province: string;
  city: string;
  zipCode: string;
}

/** Purpose-built for this file's exact simple shape (`Province:` then 2-space-indented
 * `City: zip` lines) - not a general YAML parser. */
function parseZipYaml(text: string): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let currentProvince: string | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      const match = line.match(/^([^:]+):\s*$/);
      if (match) currentProvince = match[1]!.trim();
      continue;
    }
    const match = line.match(/^\s+(.+?):\s*(\d+)\s*$/);
    if (match && currentProvince) {
      entries.push({ province: currentProvince, city: match[1]!.trim(), zipCode: match[2]! });
    }
  }
  return entries;
}

/** Strips formatting differences between the two datasets so the same real place matches
 * regardless of which convention it's written in - see this file's own doc comment for examples. */
function normalizeCityName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\([^)]*\)/g, '') // drop parenthetical notes, e.g. "(Capital)", "(San Pedro)"
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^CITY OF\s+/, '')
    .replace(/\s+CITY$/, '')
    .trim();
}

/** Same idea as `normalizeCityName` but for provinces - our table spells some provinces with a
 * parenthetical alternate name (e.g. "COTABATO (NORTH COTABATO)", "SAMAR (WESTERN SAMAR)") that
 * the reference file writes as just "North Cotabato"/"Samar". */
function normalizeProvinceName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main(): Promise<void> {
  const yamlText = fs.readFileSync(YAML_PATH, 'utf-8');
  const zipEntries = parseZipYaml(yamlText);
  console.log(`Parsed ${zipEntries.length} province/city/zip entries from the reference file.`);

  const provinces = await prisma.psgcProvince.findMany({ select: { code: true, name: true } });
  const cities = await prisma.psgcCityMunicipality.findMany({ select: { code: true, name: true, provinceCode: true } });

  // Indexed by both the primary (paren-stripped) name AND the parenthetical alternate name, e.g.
  // "COTABATO (NORTH COTABATO)" indexes as both "COTABATO" and "NORTH COTABATO" - the reference
  // file calls this province by its alternate name ("North Cotabato"), not the primary one.
  const provinceCodeByNormalizedName = new Map<string, string>();
  for (const p of provinces) {
    provinceCodeByNormalizedName.set(normalizeProvinceName(p.name), p.code);
    const altMatch = p.name.match(/\(([^)]+)\)/);
    if (altMatch) provinceCodeByNormalizedName.set(normalizeProvinceName(altMatch[1]!), p.code);
  }
  const citiesByProvinceAndNormalizedName = new Map<string, { code: string; name: string }[]>();
  for (const c of cities) {
    const key = `${c.provinceCode}::${normalizeCityName(c.name)}`;
    const arr = citiesByProvinceAndNormalizedName.get(key) ?? [];
    arr.push({ code: c.code, name: c.name });
    citiesByProvinceAndNormalizedName.set(key, arr);
  }

  let matched = 0;
  let noProvinceMatch = 0;
  let noCityMatch = 0;
  let ambiguousCityMatch = 0;
  const updates: { code: string; zipCode: string }[] = [];

  for (const entry of zipEntries) {
    const provinceCode = provinceCodeByNormalizedName.get(normalizeProvinceName(entry.province));
    if (!provinceCode) {
      noProvinceMatch++;
      continue;
    }
    const key = `${provinceCode}::${normalizeCityName(entry.city)}`;
    const candidates = citiesByProvinceAndNormalizedName.get(key) ?? [];
    if (candidates.length === 0) {
      noCityMatch++;
      continue;
    }
    if (candidates.length > 1) {
      ambiguousCityMatch++;
      continue;
    }
    updates.push({ code: candidates[0]!.code, zipCode: entry.zipCode });
    matched++;
  }

  console.log(`\n=== Reconciliation ===`);
  console.log(`source entries: ${zipEntries.length}`);
  console.log(`matched (will update): ${matched}`);
  console.log(`skipped (no matching province): ${noProvinceMatch}`);
  console.log(`skipped (no matching city in that province): ${noCityMatch}`);
  console.log(`skipped (ambiguous - multiple cities matched): ${ambiguousCityMatch}`);

  if (!APPLY) {
    console.log('\nDry run complete - no data was written. Re-run with --apply to write to the database.');
    await prisma.$disconnect();
    return;
  }

  for (const u of updates) {
    await prisma.psgcCityMunicipality.update({ where: { code: u.code }, data: { zipCode: u.zipCode } });
  }
  console.log(`\nApplied: ${updates.length} zipCode values written.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
