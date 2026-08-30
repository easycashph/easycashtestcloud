/**
 * One-time backfill (2026-08-30, user-confirmed): creates the missing DISBURSEMENT LoanTransaction
 * for any ACTIVE/ACTIVE_IN_ARREARS loan that has none on file at all. Found via the CIC monthly
 * report's "changed this month" scoping (§30l in the session log) - 6 real August 2026 loans had
 * `activatedAt` set but zero transactions, which turned out to all carry a `legacyId` (migrated
 * from SDevTech, not created through this LMS's own "Disburse Loan" flow, which always creates this
 * transaction atomically with activation - see `ActivateLoanUseCase.ts`). `migrate-legacy-data.ts`
 * itself documents that only ~21% of legacy loans have a DISBURSEMENT transaction in the source
 * dump; this closes that specific gap. User confirmed directly: every loan in this candidate set
 * was genuinely disbursed in real life - this is a missing RECORD, not a real pending-release
 * state, so backfilling it (rather than leaving it blank) is correct.
 *
 * `entryDate` uses `activatedAt` (the closest real date already on file) since there is no more
 * precise disbursement date recorded anywhere for these legacy rows. `postedByUserId` is left null
 * (no specific staff member "posted" this - it's a data backfill, not a live action), with a
 * `comment` documenting that plainly on the transaction itself.
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-disbursement-transactions.ts          # dry run
 *   npx tsx scripts/backfill-missing-disbursement-transactions.ts --apply  # writes
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log(`=== Missing DISBURSEMENT transaction backfill (${APPLY ? 'APPLY' : 'dry run'}) ===`);

  const loans = await prisma.loanAccount.findMany({
    where: { status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] } },
    include: { transactions: { where: { type: 'DISBURSEMENT' } } },
  });
  const missing = loans.filter((l) => l.transactions.length === 0 && l.activatedAt !== null);

  console.log(`${missing.length} loan(s) missing a DISBURSEMENT transaction.\n`);

  for (const loan of missing) {
    console.log(`  ${loan.loanCode} - principal ${loan.principalAmount} - entryDate ${loan.activatedAt!.toISOString().slice(0, 10)}`);
    if (APPLY) {
      await prisma.loanTransaction.create({
        data: {
          id: randomUUID(),
          loanAccountId: loan.id,
          type: 'DISBURSEMENT',
          amount: loan.principalAmount,
          principalComponent: loan.principalAmount,
          balanceAfter: loan.principalAmount,
          postedByUserId: null,
          branchId: loan.branchId,
          entryDate: loan.activatedAt!,
          comment: 'Backfilled 2026-08-30 - loan was confirmed genuinely disbursed but had no DISBURSEMENT transaction on file (legacy migration gap, see migrate-legacy-data.ts).',
        },
      });
    }
  }

  console.log(`\n${APPLY ? 'Created' : 'Would create'} ${missing.length} DISBURSEMENT transaction(s).`);
  if (!APPLY) console.log('Dry run only - re-run with --apply to write these changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
