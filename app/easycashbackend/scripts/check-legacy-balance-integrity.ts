/**
 * 2026-08-05 (user request): routine spot-check to run after every future SDevTech legacy
 * migration/re-sync — read-only, no writes, safe to run any time.
 *
 * Origin: found via a real case (SL-CORP_00124, Gerald Munoz Gonzales) showing ₱0 Collections
 * Balance despite a genuine unpaid ₱22,332.63+₱2,673.88 on its own RepaymentSchedule. Root cause:
 * the raw SDevTech source record had NO account-level balance snapshot fields at all (not zero —
 * absent), same population `flag-missing-balance-loans.ts` (CP12 follow-up, 2026-07-09) already
 * covers for the original migration batch — but 3 more loans (SL-CORP_00124, SML-REG_00378,
 * SML-REG_00380) appeared in a LATER legacy dump snapshot and were never caught by that one-time
 * check. `migrate-legacy-data.ts`'s `hasAccountLevelBalanceData` check (fixed 2026-08-04) should
 * flag any brand-new loan created this way going forward (`legacyBalanceDataMissing: true`) — this
 * script is the safety net in case a future migration run still slips one through, and separately
 * flags any already-`legacyBalanceDataMissing` loan that recompute-active-loan-balances-from-
 * schedule.ts couldn't fix (no RepaymentSchedule rows at all yet).
 *
 * Checks (read-only, against Postgres only — no legacy dump needed):
 *   A) ACTIVE/ACTIVE_IN_ARREARS loans reading principalBalance = 0 despite owing real, unpaid
 *      principal on their own RepaymentSchedule — the exact bug this script exists to catch.
 *   B) legacyBalanceDataMissing = true loans (ACTIVE/ACTIVE_IN_ARREARS) with NO RepaymentSchedule
 *      rows at all — flagged as missing, but recompute-active-loan-balances-from-schedule.ts has
 *      nothing to derive a real balance from; needs a schedule migrated first.
 *
 * Next steps if either check finds something:
 *   - Category A: confirm the raw SDevTech record really has no balance snapshot (see
 *     check-multi-adhoc.ts's approach earlier this session for how), then run
 *     `npx tsx scripts/backfill-newly-discovered-missing-balance-loans.ts` (or a copy of it
 *     updated with the newly-found loan codes) to fix.
 *   - Category B: run `migrate-repayment-schedules.ts` (or confirm why the schedule is still
 *     missing) before the balance can be derived.
 *
 * Usage: npx tsx scripts/check-legacy-balance-integrity.ts
 * Exit code 0 = clean, 1 = found issues (or a script error).
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

async function main(): Promise<void> {
  console.log('=== Legacy balance integrity spot-check ===\n');

  // A) principalBalance = 0 despite a real, unpaid RepaymentSchedule.
  const zeroBalanceButOwed = await prisma.$queryRaw<
    { loanCode: string; legacyId: string | null; principalAmount: string; scheduleOwed: string }[]
  >`
    SELECT la."loanCode", la."legacyId", la."principalAmount"::text,
           SUM(rs."principalDue" - rs."principalPaid")::text AS "scheduleOwed"
    FROM loan_accounts la
    JOIN repayment_schedules rs ON rs."loanAccountId" = la.id
    WHERE la.status IN ('ACTIVE', 'ACTIVE_IN_ARREARS')
      AND la."legacyId" IS NOT NULL
      AND la."principalBalance" = 0
      AND la."principalAmount" > 0
    GROUP BY la.id, la."loanCode", la."legacyId", la."principalAmount"
    HAVING SUM(rs."principalDue" - rs."principalPaid") > 0
    ORDER BY la."loanCode"
  `;

  console.log(`A) ACTIVE/ACTIVE_IN_ARREARS loans with ₱0 principalBalance despite real unpaid schedule: ${zeroBalanceButOwed.length}`);
  for (const row of zeroBalanceButOwed) {
    console.log(`   ${row.loanCode} (legacyId=${row.legacyId}) - principalAmount=${row.principalAmount}, schedule owes=${row.scheduleOwed}`);
  }

  // B) legacyBalanceDataMissing=true but no schedule to recompute from.
  const missingWithNoSchedule = await prisma.loanAccount.findMany({
    where: {
      legacyBalanceDataMissing: true,
      status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
      repaymentSchedule: { none: {} },
    },
    select: { loanCode: true, legacyId: true, principalAmount: true },
  });

  console.log(`\nB) legacyBalanceDataMissing=true loans with NO RepaymentSchedule rows at all: ${missingWithNoSchedule.length}`);
  for (const row of missingWithNoSchedule) {
    console.log(`   ${row.loanCode} (legacyId=${row.legacyId}) - principalAmount=${row.principalAmount}`);
  }

  const totalIssues = zeroBalanceButOwed.length + missingWithNoSchedule.length;
  console.log(`\n=== ${totalIssues === 0 ? 'Clean - no issues found.' : `${totalIssues} loan(s) need attention - see above.`} ===`);

  await prisma.$disconnect();
  process.exitCode = totalIssues === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
