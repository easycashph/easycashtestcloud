/**
 * 2026-09-03 (user-confirmed, same root cause as resync-stale-migrated-loan-balances.ts's
 * principal/interest/fees fix): `loan_accounts.penaltyBalance` went stale for migrated loans the
 * same way principal/interest/fees did - `migrate-legacy-data.ts` wrote it once from SDevTech's
 * account-level snapshot, while `migrate-repayment-schedules.ts` separately wrote
 * `repayment_schedules.penaltyDue` from SDevTech's schedule-level rows, and the two SDevTech
 * sources didn't always agree.
 *
 * Business decision (2026-09-03, user): penalty on migrated loans stays FROZEN - follow whatever
 * SDevTech says - until SDevTech is retired, at which point migrated loans switch to live
 * ADR-050 auto-compute like prospective loans (`CurrentPenaltyResolver`'s existing
 * `isProspectiveLoan` check already gates that switch). `AddPenaltyUseCase` is the sanctioned way
 * staff keep a migrated loan's penalty current with SDevTech in the meantime, and it already keeps
 * `repayment_schedules.penaltyDue` and `loan_accounts.penaltyBalance` in sync going forward (see
 * that use case) - so `repayment_schedules` is the more current, granular figure to trust here,
 * same as for principal/interest/fees.
 *
 * Re-derives ONLY penaltyBalance/penaltyDue/penaltyPaid from `repayment_schedules`, for any
 * migrated (`legacyId` not null) active loan where the cached balance disagrees with the schedule
 * by more than a centavo. Does not touch principal/interest/fees (already resynced separately).
 *
 * Usage: npx tsx scripts/resync-stale-migrated-loan-penalty.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

function toDecimalString(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

async function main(): Promise<void> {
  console.log(`=== Resync stale migrated-loan penalty balances ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

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

    let penaltyDue = 0, penaltyPaid = 0;
    for (const inst of loan.repaymentSchedule) {
      penaltyDue += Number(inst.penaltyDue);
      penaltyPaid += Number(inst.penaltyPaid);
    }
    const penaltyBalance = Math.max(0, penaltyDue - penaltyPaid);

    const cachedPenalty = Number(loan.penaltyBalance);
    const mismatch = Math.abs(cachedPenalty - penaltyBalance) > 0.01;
    if (!mismatch) { skippedNoMismatch++; continue; }

    console.log(`  ${loan.loanCode} (${loan.borrower.firstName} ${loan.borrower.lastName}): penalty ${cachedPenalty.toFixed(2)} -> ${penaltyBalance.toFixed(2)}`);

    if (!DRY_RUN) {
      await prisma.loanAccount.update({
        where: { id: loan.id },
        data: {
          penaltyBalance: toDecimalString(penaltyBalance),
          penaltyDue: toDecimalString(penaltyBalance),
          penaltyPaid: toDecimalString(penaltyPaid),
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
