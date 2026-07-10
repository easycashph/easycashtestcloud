/**
 * CP12 migration follow-up #4 (2026-07-09) — supersedes the earlier, partially-successful
 * `reconstruct-active-loan-balances.ts` (which derived only principalBalance reliably and got
 * fees/interest/penalty wrong for over half of the 191 affected loans). Now that
 * `migrate-repayment-schedules.ts` has populated real, authoritative `RepaymentSchedule` rows
 * (from legacy `repayments.bson`), every balance component is directly summable with no
 * inference or allocation-order guessing at all.
 *
 * Verified against a real screenshot of the legacy production system's own Payment Schedule tab
 * for SML-MAX_00002 (Vincent Mark Jardeniano Gemolaga, 2026-07-09) — every Principal/Interest/
 * Fees/Penalty Due total computed this exact way matched the screenshot exactly.
 *
 * Scoped to ACTIVE/ACTIVE_IN_ARREARS loans with `legacyBalanceDataMissing = true` (the same 191
 * loans `flag-missing-balance-loans.ts` identified) — a CLOSED loan reading 0.00 remains
 * plausible (paid off) and is left untouched.
 *
 * balances = SUM(due) - SUM(paid) per component, across that loan's RepaymentSchedule rows.
 * Does NOT clear `legacyBalanceDataMissing` (documents provenance: reconstructed, not sourced
 * directly from an account-level legacy snapshot).
 *
 * Usage: npx tsx scripts/recompute-active-loan-balances-from-schedule.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

function toDecimalString(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

async function main(): Promise<void> {
  console.log(`=== Recompute active-loan balances from real schedule data ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const affected = await prisma.loanAccount.findMany({
    where: {
      legacyBalanceDataMissing: true,
      status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
    },
    include: { repaymentSchedule: true },
  });
  console.log(`Active/ActiveInArrears loans flagged with missing balance data: ${affected.length}`);

  let updated = 0, noSchedule = 0;

  for (const loan of affected) {
    if (loan.repaymentSchedule.length === 0) { noSchedule++; continue; }

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
    if (updated <= 5) {
      console.log(
        `  ${loan.loanCode}: principal=${toDecimalString(principalBalance)} interest=${toDecimalString(interestBalance)} fees=${toDecimalString(feesBalance)} penalty=${toDecimalString(penaltyBalance)}`,
      );
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Recomputed from real schedule data: ${updated}`);
  console.log(`No schedule rows found (left untouched): ${noSchedule}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
