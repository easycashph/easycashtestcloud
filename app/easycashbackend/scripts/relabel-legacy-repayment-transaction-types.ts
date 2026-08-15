/**
 * 2026-08-15 — retroactively relabels already-migrated `ADJUSTMENT` transactions that were
 * originally SDevTech `FEE_REPAYMENT` / `PENALTY_REPAYMENT` rows.
 *
 * Why: `TRANSACTION_TYPE_MAP` in `migrate-legacy-data.ts` used to flatten those two into
 * `ADJUSTMENT` along with genuine staff corrections (write-offs, repayment undos, due-amount
 * reductions). They are not corrections — they are real borrower payments, just split out per
 * component the way SDevTech records them (a ₱7,936 payment covering a ₱936 fee arrives there as
 * `FEE_REPAYMENT` ₱936 + `REPAYMENT` ₱7,000). Collapsing them made a client payment
 * indistinguishable from a write-off in reports and audit trails.
 *
 * Found via a Daily Collection Report comparison on `SML-PDC_00035` (Rafael Alarcon Baguio), whose
 * ₱936 "Fee Repayment" in SDevTech (OR 2471) appeared here as "Adjustment". The map is fixed for
 * future imports; this script fixes rows already in the database.
 *
 * Not a guess: each row's original SDevTech type is read back from the legacy dump and matched by
 * `legacyId`, exactly as `backfill-payment-allocations.ts` does. Only rows whose source type is
 * literally `FEE_REPAYMENT` or `PENALTY_REPAYMENT` are touched — the other ~5,450 migrated
 * `ADJUSTMENT` rows are genuine corrections and are left alone.
 *
 * Changes the `type` column only. No amount, component, balance, installment, or allocation is
 * touched, so no figure the LMS computes can change — this is purely a labelling correction.
 *
 * Idempotent: re-running finds nothing left to do (already-relabelled rows are no longer
 * `ADJUSTMENT`). Safe to run after any future migration.
 *
 * Usage: npx tsx scripts/relabel-legacy-repayment-transaction-types.ts [--apply]
 *        (dry run by default)
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const DUMP_DIR = legacyDbEasycashDir();
const APPLY = process.argv.includes('--apply');

/** Legacy source type -> the target type it should now carry. */
const RELABEL: Record<string, 'FEE_REPAYMENT' | 'PENALTY_REPAYMENT'> = {
  FEE_REPAYMENT: 'FEE_REPAYMENT',
  PENALTY_REPAYMENT: 'PENALTY_REPAYMENT',
};

function readAll<T>(file: string): T[] {
  const buf = fs.readFileSync(path.join(DUMP_DIR, file));
  let offset = 0;
  const docs: T[] = [];
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    if (size <= 0) break;
    docs.push(BSON.deserialize(buf.subarray(offset, offset + size), { promoteValues: true }) as T);
    offset += size;
  }
  return docs;
}

async function main(): Promise<void> {
  console.log(`=== Relabel legacy FEE_REPAYMENT / PENALTY_REPAYMENT transactions ${APPLY ? '' : '(DRY RUN — no writes)'} ===`);

  const legacyTypeById = new Map<string, string>();
  for (const t of readAll<{ _id: unknown; uid?: string; type: string }>('loan_transactions.bson')) {
    legacyTypeById.set(String(t.uid ?? t._id), String(t.type).toUpperCase());
  }
  console.log(`loan_transactions.bson: ${legacyTypeById.size} source types indexed`);

  const candidates = await prisma.loanTransaction.findMany({
    where: { type: 'ADJUSTMENT', legacyId: { not: null } },
    select: { id: true, legacyId: true, amount: true, loanAccount: { select: { loanCode: true } } },
  });
  console.log(`Migrated ADJUSTMENT rows to examine: ${candidates.length}`);

  const toRelabel: { id: string; target: 'FEE_REPAYMENT' | 'PENALTY_REPAYMENT'; loanCode: string; amount: string }[] = [];
  let noSourceType = 0;

  for (const row of candidates) {
    const sourceType = legacyTypeById.get(row.legacyId!);
    if (!sourceType) {
      noSourceType++;
      continue;
    }
    const target = RELABEL[sourceType];
    if (!target) continue; // a genuine correction - leave it alone
    toRelabel.push({ id: row.id, target, loanCode: row.loanAccount.loanCode, amount: row.amount.toString() });
  }

  const byTarget = new Map<string, number>();
  for (const r of toRelabel) byTarget.set(r.target, (byTarget.get(r.target) ?? 0) + 1);

  console.log(`\nRows ${APPLY ? 'being relabelled' : 'that would be relabelled'}: ${toRelabel.length}`);
  for (const [target, count] of byTarget) console.log(`  -> ${target}: ${count}`);
  if (noSourceType > 0) console.log(`Skipped - no matching row in the dump: ${noSourceType}`);

  if (toRelabel.length > 0) {
    console.log('\nSample (first 10):');
    for (const r of toRelabel.slice(0, 10)) console.log(`  ${r.loanCode}  ₱${r.amount}  -> ${r.target}`);
  }

  if (APPLY) {
    for (const [target, _] of byTarget) {
      const ids = toRelabel.filter((r) => r.target === target).map((r) => r.id);
      await prisma.loanTransaction.updateMany({
        where: { id: { in: ids } },
        data: { type: target as 'FEE_REPAYMENT' | 'PENALTY_REPAYMENT' },
      });
    }
    console.log('\nDone.');
  } else {
    console.log('\nDry run only — re-run with --apply to write.');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
