/**
 * Sanity check, not a backfill (2026-08-30, user-confirmed): catches the exact class of bug this
 * session hit three times - a loan gets a fresh `RepaymentSchedule` (via a Loan Restructure/
 * Compromise Settlement, `migrate-legacy-data.ts`'s status-mapping fix, or `migrate-repayment-
 * schedules.ts`), but `recompute-active-loan-balances-from-schedule.ts` never gets re-run
 * afterward - so the loan's own `principalBalance`/`interestBalance`/etc. stay frozen at whatever
 * they were before (often 0.00, since `legacyBalanceDataMissing: true` loans have no raw
 * account-level snapshot to fall back on). The Dashboard's Portfolio at Risk metric silently
 * undercounts `total_outstanding` for exactly these loans - the bug that motivated this script,
 * caught by comparing this Mac's numbers against a live Office Server PC report by hand.
 *
 * NOT the same check as "does `legacyBalanceDataMissing: true` + has a schedule" -
 * `recompute-active-loan-balances-from-schedule.ts` deliberately never clears that flag (documents
 * provenance), so that alone can't distinguish "already correctly recomputed" from "genuinely
 * stale" - every loan it ever touches would match forever, a false positive on every run. Instead
 * this actually RECOMPUTES what each candidate's `principalBalance` should be (same formula: sum
 * of `principalDue - principalPaid` across its schedule) and flags only loans where the STORED
 * value disagrees with that - i.e. only loans that would genuinely change if
 * `recompute-active-loan-balances-from-schedule.ts` ran again right now. Read-only - never writes.
 *
 * Usage: npx tsx scripts/check-balance-recompute-needed.ts
 * Exit code 1 if anything is flagged (so it can gate a CI/script pipeline), 0 if clean.
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function main(): Promise<void> {
  console.log('=== Check: does recompute-active-loan-balances-from-schedule.ts need to run? ===');

  const candidates = await prisma.loanAccount.findMany({
    where: {
      legacyBalanceDataMissing: true,
      status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS', 'CLOSED_RESTRUCTURED', 'CLOSED_COMPROMISED'] },
    },
    include: { repaymentSchedule: true },
  });

  const flagged: { loanCode: string; status: string; stored: number; recomputed: number }[] = [];
  for (const loan of candidates) {
    if (loan.repaymentSchedule.length === 0) continue; // nothing to recompute from - not this script's concern
    const recomputed = round2(
      Math.max(
        0,
        loan.repaymentSchedule.reduce((sum, inst) => sum + Number(inst.principalDue) - Number(inst.principalPaid), 0),
      ),
    );
    const stored = round2(Number(loan.principalBalance));
    if (Math.abs(recomputed - stored) > 0.01) {
      flagged.push({ loanCode: loan.loanCode, status: loan.status, stored, recomputed });
    }
  }

  if (flagged.length === 0) {
    console.log(`Clean - ${candidates.length} loan(s) checked, all already match what a fresh recompute would produce.`);
    process.exitCode = 0;
    return;
  }

  console.log(`FLAGGED: ${flagged.length} loan(s) have a stored balance that disagrees with their own schedule:`);
  for (const loan of flagged.slice(0, 20)) {
    console.log(`  ${loan.loanCode} (${loan.status}) - stored principalBalance=${loan.stored}, schedule says ${loan.recomputed}`);
  }
  if (flagged.length > 20) console.log(`  ... and ${flagged.length - 20} more`);
  console.log('\nFix: npx tsx scripts/recompute-active-loan-balances-from-schedule.ts');
  console.log('     (that script applies by default - pass --dry-run first if you want to preview).');
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
