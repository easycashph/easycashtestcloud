/* eslint-disable no-console */
/**
 * CP12 follow-up — read-only analysis of the 243,507 "orphaned" loan_transactions rows (46.7% of
 * 524,463) whose `parent_account_key` matches no migrated `loan_accounts` row (see
 * docs/Architecture/CP12-legacy-migration-report.md's "Known gaps" section). Never writes
 * anything, never touches Postgres, never modifies the legacy dump (CLAUDE.md "never modify
 * legacy data during migration") - pure read/report, same join key as migrate-legacy-data.ts
 * (`tx.parent_account_key` vs `loanAccount.uid ?? loanAccount._id`).
 *
 * Answers: do these orphaned account keys exist ANYWHERE else in the legacy export (a recoverable
 * migration-scope gap), or are they genuinely absent from every collection (permanent legacy data
 * gap, e.g. accounts purged before this dump was taken)?
 *
 * Usage: npx tsx scripts/analyze-orphaned-transactions.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const DUMP_DIR = legacyDbEasycashDir();

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

async function main(): Promise<void> {
  console.log(`Dump directory: ${DUMP_DIR}\n`);

  console.log('Loading loan_accounts.bson...');
  const accountKeys = new Set<string>();
  let accountCount = 0;
  for (const la of iterDocs<{ uid?: unknown; _id?: unknown }>('loan_accounts')) {
    accountCount++;
    accountKeys.add(String(la.uid ?? la._id));
  }
  console.log(`  ${accountCount} loan_accounts rows, ${accountKeys.size} distinct keys.\n`);

  console.log('Streaming loan_transactions.bson (this is the big one, ~588MB)...');
  let txCount = 0;
  let matched = 0;
  let orphaned = 0;
  const orphanedKeyCounts = new Map<string, number>();
  const sampleOrphanedKeys: string[] = [];
  const sampleMatchedKeys: string[] = [];

  for (const tx of iterDocs<{ parent_account_key?: unknown }>('loan_transactions')) {
    txCount++;
    const key = String(tx.parent_account_key);
    if (accountKeys.has(key)) {
      matched++;
      if (sampleMatchedKeys.length < 5) sampleMatchedKeys.push(key);
    } else {
      orphaned++;
      orphanedKeyCounts.set(key, (orphanedKeyCounts.get(key) ?? 0) + 1);
      if (sampleOrphanedKeys.length < 10) sampleOrphanedKeys.push(key);
    }
    if (txCount % 100_000 === 0) console.log(`  ...${txCount} transactions processed`);
  }

  console.log(`\n=== Results ===`);
  console.log(`Total loan_transactions: ${txCount}`);
  console.log(`Matched to a migrated loan_accounts row: ${matched} (${((matched / txCount) * 100).toFixed(1)}%)`);
  console.log(`Orphaned (no matching loan_accounts row): ${orphaned} (${((orphaned / txCount) * 100).toFixed(1)}%)`);
  console.log(`Distinct orphaned parent_account_key values: ${orphanedKeyCounts.size}`);
  console.log(`\nSample matched keys (format reference): ${sampleMatchedKeys.join(', ')}`);
  console.log(`Sample orphaned keys: ${sampleOrphanedKeys.join(', ')}`);

  // Key-format comparison - if orphaned keys look structurally different from matched keys (e.g.
  // different length/character set), that's a strong signal of a format-mismatch bug rather than
  // genuinely-missing accounts.
  const matchedLengths = new Set(sampleMatchedKeys.map((k) => k.length));
  const orphanedLengths = new Set(sampleOrphanedKeys.map((k) => k.length));
  console.log(`\nMatched key lengths seen: ${[...matchedLengths].join(', ')}`);
  console.log(`Orphaned key lengths seen: ${[...orphanedLengths].join(', ')}`);

  // Top orphaned keys by transaction count - if a handful of keys account for a huge share, that's
  // worth naming specifically (e.g. one big archived/closed account).
  const topOrphaned = [...orphanedKeyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\nTop 10 orphaned keys by transaction count:`);
  for (const [key, count] of topOrphaned) {
    console.log(`  ${key}: ${count} transactions`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
