/**
 * 2026-08-14 — backfills `PaymentAllocation` rows for MIGRATED repayment transactions, using the
 * legacy export's own `loan_transactions.parent_repayment_key` field.
 *
 * Why this exists: `ReversePaymentUseCase` refuses any REPAYMENT with no `PaymentAllocation`
 * breakdown (`NoReversibleAllocationDataError`) because it can't know which installment(s) to undo.
 * CP12 never populated that table for legacy data, so every migrated payment was un-reversible and
 * had to go through the coarser Manual Payment Adjustment tool instead.
 *
 * What makes this safe rather than a guess: `parent_repayment_key` is SDevTech's OWN recorded link
 * from a transaction to the exact `repayments` row it paid — this script only copies that link, it
 * never infers or reconstructs an allocation. Verified against real data before writing this: e.g.
 * transaction `67340b103d54b136ae280008` (₱47,754.68 = ₱39,740.12 principal + ₱8,014.56 interest)
 * points at an installment whose `principal_paid`/`interest_paid` are exactly those two figures.
 *
 * Coverage is deliberately partial — only ~8.5% of non-reversed legacy REPAYMENT transactions
 * (2,739 of 32,240, across 452 loans) carry a resolvable `parent_repayment_key`; the field appears
 * to have been added late in SDevTech's life, so older payments simply don't have it. The remaining
 * ~91.5% are left alone ON PURPOSE. Deriving them by replaying an allocation waterfall was
 * considered and rejected (2026-08-13): guessing wrong silently reverses the wrong installment,
 * the exact class of bug that left `SL-CORP_00114` stuck "In Arrears". Those stay on Manual Payment
 * Adjustment, where a human picks the installment explicitly.
 *
 * Purely additive: writes `PaymentAllocation` rows only. Touches no balance, no installment, no
 * transaction, no loan account — so it cannot change any figure the LMS displays today. Its only
 * effect is that Reverse Payment becomes available on the transactions it covers.
 *
 * Idempotent: skips any transaction that already has at least one allocation row (whether from a
 * previous run of this script or from a native `ProcessPaymentUseCase` payment).
 *
 * Usage: npx tsx scripts/backfill-payment-allocations.ts [--apply]
 *        (dry run by default — prints what it would write and exits without touching the database)
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const DUMP_DIR = legacyDbEasycashDir();
const APPLY = process.argv.includes('--apply');

interface LegacyTransaction {
  _id: unknown;
  uid?: string;
  type: string;
  parent_account_key: string;
  parent_repayment_key?: string | null;
  reversal_transaction_key?: string | null;
}

interface LegacyRepayment {
  _id: unknown;
  uid: string;
}

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
  console.log(`=== Backfill PaymentAllocation from legacy parent_repayment_key ${APPLY ? '' : '(DRY RUN — no writes)'} ===`);

  // The legacy field points at a `repayments` row's `uid`, but migrate-repayment-schedules.ts keys
  // RepaymentSchedule.legacyId off that row's `_id` instead - so this map is the required hop.
  const repaymentIdByUid = new Map<string, string>();
  for (const r of readAll<LegacyRepayment>('repayments.bson')) {
    repaymentIdByUid.set(String(r.uid), String(r._id));
  }
  console.log(`repayments.bson: ${repaymentIdByUid.size} uid->_id entries`);

  const linked = readAll<LegacyTransaction>('loan_transactions.bson').filter(
    (t) =>
      String(t.type).toUpperCase() === 'REPAYMENT' &&
      !t.reversal_transaction_key &&
      t.parent_repayment_key != null &&
      String(t.parent_repayment_key) !== '',
  );
  console.log(`loan_transactions.bson: ${linked.length} non-reversed REPAYMENTs carry parent_repayment_key`);

  let created = 0;
  let skippedNoTransaction = 0;
  let skippedNoInstallment = 0;
  let skippedAlreadyAllocated = 0;
  let skippedZeroComponents = 0;
  const mismatchedLoan: string[] = [];

  for (const tx of linked) {
    const txLegacyId = String(tx.uid ?? tx._id);
    const installmentLegacyId = repaymentIdByUid.get(String(tx.parent_repayment_key));
    if (!installmentLegacyId) {
      skippedNoInstallment++;
      continue;
    }

    const transaction = await prisma.loanTransaction.findUnique({
      where: { legacyId: txLegacyId },
      select: {
        id: true,
        loanAccountId: true,
        type: true,
        principalComponent: true,
        interestComponent: true,
        feesComponent: true,
        penaltyComponent: true,
        paymentAllocations: { select: { id: true }, take: 1 },
      },
    });
    if (!transaction || transaction.type !== 'REPAYMENT') {
      skippedNoTransaction++;
      continue;
    }
    if (transaction.paymentAllocations.length > 0) {
      skippedAlreadyAllocated++;
      continue;
    }

    const installment = await prisma.repaymentSchedule.findUnique({
      where: { legacyId: installmentLegacyId },
      select: { id: true, loanAccountId: true },
    });
    if (!installment) {
      skippedNoInstallment++;
      continue;
    }

    // Safety: the legacy link must stay within one loan. A cross-loan pairing would mean the export
    // is inconsistent - refuse it rather than write an allocation that could later reverse a
    // payment against someone else's loan.
    if (installment.loanAccountId !== transaction.loanAccountId) {
      mismatchedLoan.push(txLegacyId);
      continue;
    }

    const components = {
      principalApplied: transaction.principalComponent,
      interestApplied: transaction.interestComponent,
      feesApplied: transaction.feesComponent,
      penaltyApplied: transaction.penaltyComponent,
    };
    const allZero = Object.values(components).every((v) => Number(v) === 0);
    if (allZero) {
      skippedZeroComponents++;
      continue;
    }

    if (APPLY) {
      await prisma.paymentAllocation.create({
        data: {
          id: randomUUID(),
          loanTransactionId: transaction.id,
          repaymentInstallmentId: installment.id,
          ...components,
        },
      });
    }
    created++;
  }

  console.log('\n=== Summary ===');
  console.log(`Allocations ${APPLY ? 'created' : 'that would be created'}: ${created}`);
  console.log(`Skipped - transaction not migrated / not a REPAYMENT here: ${skippedNoTransaction}`);
  console.log(`Skipped - installment not found (dangling legacy key):     ${skippedNoInstallment}`);
  console.log(`Skipped - transaction already has allocations:             ${skippedAlreadyAllocated}`);
  console.log(`Skipped - all components zero (nothing to allocate):       ${skippedZeroComponents}`);
  if (mismatchedLoan.length > 0) {
    console.log(`\nREFUSED - legacy link crossed loan accounts (${mismatchedLoan.length}): ${mismatchedLoan.slice(0, 10).join(', ')}`);
  }
  if (!APPLY) console.log('\nDry run only — re-run with --apply to write.');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
