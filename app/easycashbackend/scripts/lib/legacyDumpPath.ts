/**
 * Resolves the newest extracted MongoDB backup under legacy/mongodb/extracted/ automatically, so
 * migrate-legacy-data.ts and its follow-up scripts never need a hand-edited, date-hardcoded
 * DUMP_DIR again after a new backup lands (see docs/Architecture/MIGRATION_LEDGER.md - every
 * script listed there that reads from the legacy MongoDB export uses this).
 *
 * Extracted folder names are the backup-mongodb.command timestamp format (YYYYMMDD_HHMMSS, e.g.
 * "20260718_233033") - lexicographic sort order matches chronological order for that format, so
 * a plain string sort picks the newest one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const EXTRACTED_ROOT = path.resolve(__dirname, '../../../../legacy/mongodb/extracted');

function latestExtractedDir(): string {
  if (!fs.existsSync(EXTRACTED_ROOT)) {
    throw new Error(
      `No extracted MongoDB backups found - "${EXTRACTED_ROOT}" doesn't exist. Extract a ` +
        `legacy/mongodb/*.zip backup first (see "legacy/Run Full Legacy Migration.command").`,
    );
  }
  const dirs = fs
    .readdirSync(EXTRACTED_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
  if (dirs.length === 0) {
    throw new Error(
      `"${EXTRACTED_ROOT}" exists but has no extracted backup folders. Extract a ` +
        `legacy/mongodb/*.zip backup first (see "legacy/Run Full Legacy Migration.command").`,
    );
  }
  return path.join(EXTRACTED_ROOT, dirs[0]!);
}

/** The db-easycash collection directory inside the newest extracted backup. */
export function legacyDbEasycashDir(): string {
  return path.join(latestExtractedDir(), 'db-easycash');
}

/** The db-address-api (PSGC) collection directory inside the newest extracted backup. */
export function legacyDbAddressApiDir(): string {
  return path.join(latestExtractedDir(), 'db-address-api');
}
