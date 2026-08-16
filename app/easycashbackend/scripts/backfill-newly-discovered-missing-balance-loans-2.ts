/**
 * 2026-08-15 - second round of `backfill-newly-discovered-missing-balance-loans.ts`, same root
 * cause: the raw SDevTech source record for this loan has no account-level balance snapshot
 * fields at all (not zero — absent), and `legacyBalanceDataMissing` was left `false` on it,
 * matching exactly what the original 3-loan backfill fixed. Found via
 * `check-legacy-balance-integrity.ts`'s routine spot-check after the 2026-08-14 SDevTech sync,
 * category A: `SP-Easy_00001` reading ₱0 principalBalance despite a genuine ₱15,000.00 unpaid on
 * its own RepaymentSchedule.
 *
 * Kept as its own file (rather than extending the original script's TARGET_LOAN_CODES) since that
 * file's own doc comment documents *why* its specific 3 loans needed the fix - mixing in an
 * unrelated later discovery would blur that history. Same fix logic, just a different loan.
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const TARGET_LOAN_CODES = ['SP-Easy_00001'];

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
