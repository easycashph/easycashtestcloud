/**
 * 2026-08-05 (user-confirmed): follow-up to `recompute-active-loan-balances-from-schedule.ts` /
 * `flag-missing-balance-loans.ts` (CP12 migration follow-up #4) - found via a real case
 * (SL-CORP_00124, Gerald Munoz Gonzales, showing ₱0 Collections Balance despite owing
 * ₱22,332.63+₱2,673.88 per its own RepaymentSchedule).
 *
 * These 3 loans (`SL-CORP_00124`, `SML-REG_00378`, `SML-REG_00380`) were created LATER than the
 * original 191-loan `flag-missing-balance-loans.ts` snapshot (2026-07-09) - they only appeared in
 * the legacy dump on 2026-07-24/27 - so they were never included in that population, even though
 * their raw source records have the exact same "no account-level balance snapshot fields at all"
 * shape (verified directly against the legacy BSON dump: only `feesDue`/`feesPaid` present, no
 * `principalBalance`/`interestBalance`/`principalDue`/`interestDue`/`penaltyBalance`/`penaltyDue`).
 * `legacyBalanceDataMissing` was incorrectly left `false` on these 3 (root cause of how that
 * happened not fully traced - not relevant to the fix - see `migrate-legacy-data.ts`'s current
 * `hasAccountLevelBalanceData` check, which is already correct for any future create).
 *
 * Fixes both in one step: sets `legacyBalanceDataMissing = true` (correct provenance), then derives
 * real balances by summing each loan's own `RepaymentSchedule` rows - same
 * `balance = SUM(due) - SUM(paid)` per component as `recompute-active-loan-balances-from-schedule.ts`.
 * All 3 loans have zero payments recorded, so balance = due in every case here.
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const TARGET_LOAN_CODES = ['SL-CORP_00124', 'SML-REG_00378', 'SML-REG_00380'];

function toDecimalString(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

async function main(): Promise<void> {
  const loans = await prisma.loanAccount.findMany({
    where: { loanCode: { in: TARGET_LOAN_CODES } },
    include: { repaymentSchedule: true },
  });

  if (loans.length !== TARGET_LOAN_CODES.length) {
    throw new Error(`Expected ${TARGET_LOAN_CODES.length} loans, found ${loans.length} - aborting.`);
  }

  for (const loan of loans) {
    if (loan.repaymentSchedule.length === 0) {
      console.log(`  SKIP ${loan.loanCode}: no repayment schedule rows`);
      continue;
    }

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

    await prisma.loanAccount.update({
      where: { id: loan.id },
      data: {
        legacyBalanceDataMissing: true,
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

    console.log(
      `  FIXED ${loan.loanCode}: principal=${toDecimalString(principalBalance)} interest=${toDecimalString(interestBalance)} fees=${toDecimalString(feesBalance)} penalty=${toDecimalString(penaltyBalance)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
