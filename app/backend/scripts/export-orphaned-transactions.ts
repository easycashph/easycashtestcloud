/* eslint-disable no-console */
/**
 * CP12 follow-up (2026-07-23, user request) — permanently preserves the ~244,242 legacy
 * loan_transactions rows whose `parent_account_key` matches no legacy loan_accounts row (confirmed
 * via scripts/analyze-orphaned-transactions.ts to be a genuine legacy data gap, not a migration-
 * scope or join-key bug — see LegacyOrphanedTransaction's own doc comment in schema.prisma).
 *
 * Never modifies the legacy dump (CLAUDE.md "never modify legacy data during migration") — pure
 * read from .bson, write to Postgres. Idempotent: upserts on `legacyTransactionId`, so a re-run
 * against the same or a newer dump never duplicates rows.
 *
 * Usage:
 *   npx tsx scripts/export-orphaned-transactions.ts            # dry run — reports counts, writes nothing
 *   npx tsx scripts/export-orphaned-transactions.ts --apply    # actually writes to the configured DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const APPLY = process.argv.includes('--apply');
const DUMP_DIR = legacyDbEasycashDir();
const BATCH_SIZE = 500;

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

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDecimalStringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

interface LegacyTx {
  uid?: unknown;
  _id?: unknown;
  parent_account_key?: unknown;
  type?: unknown;
  amount?: unknown;
  entry_date?: unknown;
  creation_date?: unknown;
  comment?: unknown;
}

async function main(): Promise<void> {
  console.log(`Dump directory: ${DUMP_DIR}`);

  console.log('Loading loan_accounts.bson keys...');
  const accountKeys = new Set<string>();
  for (const la of iterDocs<{ uid?: unknown; _id?: unknown }>('loan_accounts')) {
    accountKeys.add(String(la.uid ?? la._id));
  }
  console.log(`  ${accountKeys.size} distinct loan_accounts keys.\n`);

  console.log('Streaming loan_transactions.bson for orphaned rows...');
  let txCount = 0;
  let orphanedCount = 0;
  let batch: {
    legacyTransactionId: string;
    parentAccountKey: string;
    legacyType: string | null;
    amount: string | null;
    entryDate: Date | null;
    comment: string | null;
    rawDocument: Record<string, unknown>;
  }[] = [];

  async function flush(): Promise<void> {
    if (batch.length === 0) return;
    if (APPLY) {
      await Promise.all(
        batch.map((row) =>
          prisma.legacyOrphanedTransaction.upsert({
            where: { legacyTransactionId: row.legacyTransactionId },
            create: row,
            update: row,
          }),
        ),
      );
    }
    batch = [];
  }

  for (const tx of iterDocs<LegacyTx>('loan_transactions')) {
    txCount++;
    const key = String(tx.parent_account_key);
    if (accountKeys.has(key)) continue;

    orphanedCount++;
    batch.push({
      legacyTransactionId: String(tx.uid ?? tx._id),
      parentAccountKey: key,
      legacyType: tx.type != null ? String(tx.type) : null,
      amount: toDecimalStringOrNull(tx.amount),
      entryDate: toDate(tx.entry_date ?? tx.creation_date),
      comment: tx.comment ? String(tx.comment) : null,
      rawDocument: JSON.parse(JSON.stringify(tx)),
    });

    if (batch.length >= BATCH_SIZE) {
      await flush();
      if (orphanedCount % 10_000 === 0) console.log(`  ...${orphanedCount} orphaned rows processed (of ${txCount} total so far)`);
    }
  }
  await flush();

  console.log(`\n=== Results ===`);
  console.log(`Total loan_transactions read: ${txCount}`);
  console.log(`Orphaned rows found: ${orphanedCount}`);

  if (!APPLY) {
    console.log('\nDry run complete - no data was written. Re-run with --apply to write to the database.');
  } else {
    const stored = await prisma.legacyOrphanedTransaction.count();
    console.log(`\nApplied: legacy_orphaned_transactions now has ${stored} rows.`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
