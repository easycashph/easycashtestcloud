/**
 * Resolves the newest extracted MongoDB backup under legacy/mongodb/extracted/ automatically, so
 * migrate-legacy-data.ts and its follow-up scripts never need a hand-edited, date-hardcoded
 * DUMP_DIR again after a new backup lands (see docs/Architecture/MIGRATION_LEDGER.md - every
 * script listed there that reads from the legacy MongoDB export uses this).
 *
 * Extracted folder names are meant to be the backup script's timestamp format (YYYYMMDD_HHMMSS,
 * e.g. "20260718_233033"), which would sort correctly alphabetically - but picks by folder
 * modification time instead, not the name, since a name-based sort silently picked a 5-day-stale
 * backup during the 2026-08-19 full migration: backup-mongodb.bat's date-parsing broke on this
 * machine's locale and produced a malformed name ("192026_184828" instead of "20260819_184828"),
 * which alphabetically sorted BEFORE the older, correctly-named backup it should have lost to (see
 * that script's own fix comment, and session log §27/§28). Modification time doesn't depend on the
 * name being well-formed, so it's safe even if a future backup run somehow mis-names its output
 * again.
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
    .map((e) => ({ name: e.name, mtimeMs: fs.statSync(path.join(EXTRACTED_ROOT, e.name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (dirs.length === 0) {
    throw new Error(
      `"${EXTRACTED_ROOT}" exists but has no extracted backup folders. Extract a ` +
        `legacy/mongodb/*.zip backup first (see "legacy/Run Full Legacy Migration.command").`,
    );
  }
  return path.join(EXTRACTED_ROOT, dirs[0]!.name);
}

/** The db-easycash collection directory inside the newest extracted backup. */
export function legacyDbEasycashDir(): string {
  return path.join(latestExtractedDir(), 'db-easycash');
}

/** The db-address-api (PSGC) collection directory inside the newest extracted backup. */
export function legacyDbAddressApiDir(): string {
  return path.join(latestExtractedDir(), 'db-address-api');
}
