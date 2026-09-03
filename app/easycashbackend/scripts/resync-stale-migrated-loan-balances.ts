/**
 * 2026-09-03 (user-confirmed, found via Michael Villarosa Fampulme's SML-MAX_P1F1A and Pedro Chua
 * Yulo's loan `2204`): `migrate-legacy-data.ts` wrote `loan_accounts.principalBalance/
 * interestBalance/feesBalance` once from SDevTech's account-level snapshot, while
 * `migrate-repayment-schedules.ts` separately wrote `repayment_schedules` from SDevTech's
 * schedule-level rows - the two SDevTech sources didn't always agree (SDevTech's own account-level
 * snapshot was itself stale relative to its schedule rows for at least 59 loans), so the mismatch
 * was carried straight into `loan_accounts`.
 *
 * `recompute-active-loan-balances-from-schedule.ts` doesn't catch these - it's scoped to
 * `legacyBalanceDataMissing: true` (loans with NO account-level snapshot at all), and these 59
 * loans DO have one (just a stale one), so `legacyBalanceDataMissing` is false for all of them.
 *
 * This script re-derives ONLY principal/interest/fees (balance, paid, due) from
 * `repayment_schedules`, for any migrated (`legacyId` not null) active loan where the cached
 * balance disagrees with the schedule by more than a centavo - regardless of
 * `legacyBalanceDataMissing`. It deliberately does NOT touch `penaltyBalance`/`penaltyDue`/
 * `penaltyPaid` - unlike principal/interest/fees, penalty on these loans is tracked via
 * `AddPenaltyUseCase` postings straight to `loan_accounts.penaltyBalance`, disconnected from
 * `repayment_schedules` (confirmed on loan `2204`, whose one schedule row has no penalty tracked
 * at all despite 44 real PENALTY_APPLIED transactions) - a separate, not-yet-resolved question
 * about whether those postings should even still be happening on migrated loans, out of scope here.
 *
 * Usage: npx tsx scripts/resync-stale-migrated-loan-balances.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

function toDecimalString(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

async function main(): Promise<void> {
  console.log(`=== Resync stale migrated-loan principal/interest/fees balances ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const loans = await prisma.loanAccount.findMany({
    where: {
      legacyId: { not: null },
      status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS', 'CLOSED_RESTRUCTURED', 'CLOSED_COMPROMISED'] },
    },
    include: { repaymentSchedule: true, borrower: true },
  });
  console.log(`Migrated active/arrears/restructured/compromised loans checked: ${loans.length}`);

  let updated = 0;
  let skippedNoSchedule = 0;
  let skippedNoMismatch = 0;

  for (const loan of loans) {
    if (loan.repaymentSchedule.length === 0) { skippedNoSchedule++; continue; }

    let principalBalance = 0, interestBalance = 0, feesBalance = 0;
    let principalPaid = 0, interestPaid = 0, feesPaid = 0;
    let principalDue = 0, interestDue = 0, feesDue = 0;

    for (const inst of loan.repaymentSchedule) {
      principalBalance += Number(inst.principalDue) - Number(inst.principalPaid);
      interestBalance += Number(inst.interestDue) - Number(inst.interestPaid);
      feesBalance += Number(inst.feesDue) - Number(inst.feesPaid);
      principalPaid += Number(inst.principalPaid);
      interestPaid += Number(inst.interestPaid);
      feesPaid += Number(inst.feesPaid);
      principalDue += Number(inst.principalDue);
      interestDue += Number(inst.interestDue);
      feesDue += Number(inst.feesDue);
    }
    principalBalance = Math.max(0, principalBalance);
    interestBalance = Math.max(0, interestBalance);
    feesBalance = Math.max(0, feesBalance);

    const cachedPrincipal = Number(loan.principalBalance);
    const cachedInterest = Number(loan.interestBalance);
    const cachedFees = Number(loan.feesBalance);

    const mismatch =
      Math.abs(cachedPrincipal - principalBalance) > 0.01 ||
      Math.abs(cachedInterest - interestBalance) > 0.01 ||
      Math.abs(cachedFees - feesBalance) > 0.01;

    if (!mismatch) { skippedNoMismatch++; continue; }

    console.log(
      `  ${loan.loanCode} (${loan.borrower.firstName} ${loan.borrower.lastName}): ` +
      `principal ${cachedPrincipal.toFixed(2)} -> ${principalBalance.toFixed(2)}, ` +
      `interest ${cachedInterest.toFixed(2)} -> ${interestBalance.toFixed(2)}, ` +
      `fees ${cachedFees.toFixed(2)} -> ${feesBalance.toFixed(2)}`,
    );

    if (!DRY_RUN) {
      await prisma.loanAccount.update({
        where: { id: loan.id },
        data: {
          principalBalance: toDecimalString(principalBalance),
          interestBalance: toDecimalString(interestBalance),
          feesBalance: toDecimalString(feesBalance),
          principalPaid: toDecimalString(principalPaid),
          interestPaid: toDecimalString(interestPaid),
          feesPaid: toDecimalString(feesPaid),
          principalDue: toDecimalString(Math.max(0, principalDue - principalPaid)),
          interestDue: toDecimalString(Math.max(0, interestDue - interestPaid)),
          feesDue: toDecimalString(Math.max(0, feesDue - feesPaid)),
        },
      });
    }
    updated++;
  }

  console.log('\n=== Summary ===');
  console.log(`Resynced: ${updated}`);
  console.log(`Already matched schedule (no change needed): ${skippedNoMismatch}`);
  console.log(`No schedule rows (left untouched): ${skippedNoSchedule}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
