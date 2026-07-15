/**
 * One-time follow-up to migrate-legacy-data.ts (2026-07-15): that script never mapped
 * LoanAccount.addOnInterestRate/contractualInterestRate at all, leaving both null for every one of
 * the 1,783 migrated loans - LoanAccount.interestRate (the field ActivateLoanUseCase actually uses
 * to run the amortization schedule) was migrated correctly and is untouched by this script;
 * addOnInterestRate/contractualInterestRate are display-only fields (Create Loan Account form,
 * Loan Releases Report), never consulted by the calculation engine.
 *
 * Two backfills, per the user's explicit decision (2026-07-15, not guessed):
 *   1. addOnInterestRate <- legacy loan_accounts.addOnRate, for the 622/1,805 legacy loans that
 *      have one. The remaining ~1,161 have no addOnRate in the legacy source itself - left null,
 *      not fabricated.
 *   2. contractualInterestRate <- a straight copy of this loan's own (already-correct)
 *      interestRate - legacy has no separate "contractual rate" field; the true contractual rate
 *      migrated safely into `interestRate` already.
 *
 * Usage: npx tsx scripts/backfill-loan-interest-rates.ts [--apply]
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const DUMP_DIR = path.resolve(__dirname, '../../../legacy/MongoDB dump/extracted/07092026_ 92543/db-easycash');

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

function toRateString(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000';
}

async function main(): Promise<void> {
  console.log(`=== Backfill addOnInterestRate / contractualInterestRate ${APPLY ? '(APPLYING)' : '(DRY RUN — no writes)'} ===`);

  // Part 1: addOnInterestRate <- legacy addOnRate, keyed by legacyId (la.uid ?? la._id — same key
  // migrate-legacy-data.ts used).
  const addOnRateByLegacyId = new Map<string, number>();
  for (const la of iterDocs<{ uid?: unknown; _id?: unknown; addOnRate?: unknown }>('loan_accounts')) {
    if (la.addOnRate === undefined || la.addOnRate === null) continue;
    const legacyId = String(la.uid ?? la._id);
    const rate = Number(la.addOnRate);
    if (Number.isFinite(rate)) addOnRateByLegacyId.set(legacyId, rate);
  }
  console.log(`Legacy loans with addOnRate: ${addOnRateByLegacyId.size}`);

  const migratedLoans = await prisma.loanAccount.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true, loanCode: true, interestRate: true, addOnInterestRate: true, contractualInterestRate: true },
  });
  console.log(`Migrated loans in DB: ${migratedLoans.length}`);

  let addOnBackfilled = 0;
  let addOnSkippedNoSource = 0;
  let addOnAlreadySet = 0;
  let contractualBackfilled = 0;
  let contractualAlreadySet = 0;

  for (const loan of migratedLoans) {
    const updates: { addOnInterestRate?: string; contractualInterestRate?: string } = {};

    if (loan.addOnInterestRate !== null) {
      addOnAlreadySet++;
    } else {
      const legacyRate = loan.legacyId ? addOnRateByLegacyId.get(loan.legacyId) : undefined;
      if (legacyRate !== undefined) {
        updates.addOnInterestRate = toRateString(legacyRate);
        addOnBackfilled++;
      } else {
        addOnSkippedNoSource++;
      }
    }

    if (loan.contractualInterestRate !== null) {
      contractualAlreadySet++;
    } else {
      updates.contractualInterestRate = loan.interestRate.toString();
      contractualBackfilled++;
    }

    if (Object.keys(updates).length > 0 && APPLY) {
      await prisma.loanAccount.update({ where: { id: loan.id }, data: updates });
    }
  }

  console.log('\n=== addOnInterestRate ===');
  console.log(`Backfilled: ${addOnBackfilled}`);
  console.log(`Already set (skipped): ${addOnAlreadySet}`);
  console.log(`No legacy source (left null): ${addOnSkippedNoSource}`);

  console.log('\n=== contractualInterestRate ===');
  console.log(`Backfilled (copied from interestRate): ${contractualBackfilled}`);
  console.log(`Already set (skipped): ${contractualAlreadySet}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
