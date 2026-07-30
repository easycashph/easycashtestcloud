/**
 * Reports which migrated loan accounts are still "legacy-safe" to keep relying on a re-imported
 * SDevTech MongoDB dump for, versus which have already "gone native" in the LMS and must not be
 * treated as legacy-sourced anymore.
 *
 * Context: `migrate-legacy-data.ts` and its follow-ups all upsert on `legacyId` with `update: {}`
 * — re-running them against a newer dump only ever ADDS brand-new legacy records; it never
 * refreshes a LoanAccount's own balance fields once that loan already exists in the LMS. So for
 * any loan that has received real payments/edits inside the LMS itself since its initial
 * migration, a fresh legacy re-import will NOT reflect that activity, and continuing to post new
 * activity for that loan in SDevTech instead of the LMS would silently diverge the two systems'
 * balances. See docs/DEVICE_SYNC_GUIDE.md and the 2026-07-10 conversation this script was written
 * from.
 *
 * Detection signal: a `LoanTransaction` with `legacyId IS NULL` was posted through the LMS itself
 * (ProcessPaymentUseCase/ActivateLoanUseCase — never the migration scripts, which always set
 * `legacyId`). A loan account with at least one such transaction has "gone native." This is a
 * factual, evidence-based signal, not a guess.
 *
 * Read-only. Never writes to the database.
 *
 * Usage: npx tsx scripts/check-legacy-sync-safety.ts
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

async function main(): Promise<void> {
  console.log('=== Legacy re-import safety check (read-only) ===\n');

  const totalLoans = await prisma.loanAccount.count();
  const migratedLoans = await prisma.loanAccount.count({ where: { legacyId: { not: null } } });
  const nativeOriginationLoans = totalLoans - migratedLoans;

  // Loans that have at least one transaction posted through the LMS itself (legacyId IS NULL).
  const goneNativeLoans = await prisma.loanAccount.findMany({
    where: { legacyId: { not: null }, transactions: { some: { legacyId: null } } },
    select: { id: true, loanCode: true, status: true },
    orderBy: { loanCode: 'asc' },
  });

  const legacySafeCount = migratedLoans - goneNativeLoans.length;

  console.log(`Total loan accounts in this database: ${totalLoans}`);
  console.log(`  Originated natively in the LMS (never in SDevTech): ${nativeOriginationLoans}`);
  console.log(`  Migrated from the legacy SDevTech/MongoDB dump: ${migratedLoans}`);
  console.log(`    Still "legacy-safe" (no LMS-native activity yet): ${legacySafeCount}`);
  console.log(`    Already "gone native" (has ≥1 LMS-posted transaction): ${goneNativeLoans.length}`);

  console.log('\n=== What this means ===');
  console.log(
    `- The ${legacySafeCount} "legacy-safe" loans have had no activity inside the LMS since migration.\n` +
      '  Re-importing a fresh SDevTech dump is still safe for these (new transactions/records will\n' +
      '  be added; nothing here gets overwritten either way, since the migration scripts never\n' +
      '  update existing rows).',
  );
  console.log(
    `- The ${goneNativeLoans.length} "gone native" loans have real LMS-posted activity. From this point on,\n` +
      '  ALL further activity for these loans (payments, status changes) must happen in the LMS,\n' +
      '  not SDevTech — a legacy re-import will never reflect new SDevTech-side activity for a loan\n' +
      "  that's already been touched here, and continuing to use both systems for the same loan\n" +
      '  risks the two balances silently diverging.',
  );

  if (goneNativeLoans.length > 0) {
    console.log(`\n=== Loans that have gone native (stop posting these in SDevTech) ===`);
    for (const loan of goneNativeLoans.slice(0, 50)) {
      console.log(`  ${loan.loanCode}  (${loan.status})`);
    }
    if (goneNativeLoans.length > 50) console.log(`  ... and ${goneNativeLoans.length - 50} more`);
  }

  console.log('\n=== Done. ===');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
