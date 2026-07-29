/**
 * One-time, idempotent follow-up (2026-07-15), found while investigating why SML-REG_00376's
 * Repayment Schedule tab was empty. That loan (plus 5 siblings - SML-REG_00372/00373/00377,
 * SML-QC_00027, SP-Easy_00001) had ZERO RepaymentSchedule rows until migrate-repayment-
 * schedules.ts was re-run today (their schedule rows were lost in an earlier local-DB restore
 * incident this session, same class of issue as legacyBalanceDataMissing/anticipatedDisbursementDate).
 *
 * These 6 loans were never flagged `legacyBalanceDataMissing = true` (they had a present, if
 * wrong, 0.00 snapshot from the original migration - not an absent one), so
 * `recompute-active-loan-balances-from-schedule.ts` (scoped to that flag) never touched them.
 * Unlike the broader "960 mismatched loans" finding (mostly legitimate legacy-snapshot-vs-schedule
 * disagreement, an open CP12 question - NOT fixed here, needs a business decision), this specific
 * population is unambiguous: `principalBalance = 0.00` while their now-migrated schedule shows a
 * real, unpaid amount due and zero paid. A loan account cannot legitimately owe nothing while its
 * own schedule says otherwise with nothing paid - this is a "balance never computed" gap, the same
 * class of bug already fixed for the 184 flagged loans, just not caught by that flag.
 *
 * Scope: ACTIVE/ACTIVE_IN_ARREARS loans where principalBalance = 0 AND the schedule sum is > 0 AND
 * schedule principalPaid sum is 0 (i.e. genuinely never paid anything - not a coincidentally-
 * settled loan). Uses the exact same SUM(due) - SUM(paid) formula as
 * recompute-active-loan-balances-from-schedule.ts.
 *
 * Usage: npx tsx scripts/recompute-zero-balance-loans-from-schedule.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

function toDecimalString(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

async function main(): Promise<void> {
  console.log(`=== Recompute zero-balance loans with real schedule data ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const candidates = await prisma.loanAccount.findMany({
    where: {
      status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
      principalBalance: 0,
    },
    include: { repaymentSchedule: true },
  });
  console.log(`ACTIVE/ActiveInArrears loans with principalBalance = 0: ${candidates.length}`);

  let updated = 0, skippedNoSchedule = 0, skippedAlreadyPaid = 0;

  for (const loan of candidates) {
    if (loan.repaymentSchedule.length === 0) { skippedNoSchedule++; continue; }

    let principalBalance = 0, interestBalance = 0, feesBalance = 0, penaltyBalance = 0;
    let principalPaid = 0, interestPaid = 0, feesPaid = 0, penaltyPaid = 0;
    let principalDue = 0, interestDue = 0, feesDue = 0, penaltyDue = 0;

    for (const inst of loan.repaymentSchedule) {
      principalBalance += Number(inst.principalDue) - Number(inst.principalPaid);
      interestBalance += Number(inst.interestDue) - Number(inst.interestPaid);
      feesBalance += Number(inst.feesDue) - Number(inst.feesPaid);
      penaltyBalance += Number(inst.penaltyDue) - Number(inst.penaltyPaid);
      principalPaid += Number(inst.principalPaid);
      interestPaid += Number(inst.interestPaid);
      feesPaid += Number(inst.feesPaid);
      penaltyPaid += Number(inst.penaltyPaid);
      principalDue += Number(inst.principalDue);
      interestDue += Number(inst.interestDue);
      feesDue += Number(inst.feesDue);
      penaltyDue += Number(inst.penaltyDue);
    }

    // Genuinely nothing owed per the schedule either - a coincidentally-settled loan, not this bug.
    if (principalBalance <= 0.01 && principalPaid === 0) { skippedAlreadyPaid++; continue; }
    // Something already paid per schedule but account shows 0 balance - out of scope for this
    // narrow, unambiguous fix; leave to the broader (not-yet-decided) reconciliation.
    if (principalPaid > 0) { skippedAlreadyPaid++; continue; }

    console.log(
      `  ${loan.loanCode}: principal=${toDecimalString(principalBalance)} interest=${toDecimalString(interestBalance)} fees=${toDecimalString(feesBalance)} penalty=${toDecimalString(penaltyBalance)}`,
    );

    if (!DRY_RUN) {
      await prisma.loanAccount.update({
        where: { id: loan.id },
        data: {
          principalBalance: toDecimalString(Math.max(0, principalBalance)),
          interestBalance: toDecimalString(Math.max(0, interestBalance)),
          feesBalance: toDecimalString(Math.max(0, feesBalance)),
          penaltyBalance: toDecimalString(Math.max(0, penaltyBalance)),
          principalPaid: toDecimalString(principalPaid),
          interestPaid: toDecimalString(interestPaid),
          feesPaid: toDecimalString(feesPaid),
          penaltyPaid: toDecimalString(penaltyPaid),
          principalDue: toDecimalString(Math.max(0, principalDue - principalPaid)),
          interestDue: toDecimalString(Math.max(0, interestDue - interestPaid)),
          feesDue: toDecimalString(Math.max(0, feesDue - feesPaid)),
          penaltyDue: toDecimalString(Math.max(0, penaltyDue - penaltyPaid)),
        },
      });
    }
    updated++;
  }

  console.log('\n=== Summary ===');
  console.log(`Recomputed: ${updated}`);
  console.log(`Skipped (no schedule rows): ${skippedNoSchedule}`);
  console.log(`Skipped (already has paid amounts or genuinely zero due - out of this narrow scope): ${skippedAlreadyPaid}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
