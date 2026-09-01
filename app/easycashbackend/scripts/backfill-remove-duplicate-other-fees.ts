/**
 * One-time backfill (2026-09-01, user-confirmed): SDevTech's "Miscellaneous Fee" (mapped to this
 * LMS's `otherFees` column by `backfill-loan-origination-fees-mongo.ts`) is NOT a real, distinct
 * 9th origination fee - it is SDevTech's own displayed SUBTOTAL of Notarial + Web + Insurance fees
 * (user-confirmed directly: "sa sdev system ang Total Miscellaneous Fee ay Notarial Fee + Web Fee
 * + Insurance Fee"). Because those three are ALSO separately stored in their own columns, having
 * `otherFees` also populated double-counts them in `netProceeds = principalAmount -
 * originationFees.total()` (OriginationFees.ts sums all 9 fields, including otherFees).
 *
 * Fix: for any loan whose `otherFees` exactly equals `notarialFee + webFee + insuranceFee`
 * (within a centavo, matching this exact SDevTech convention), zero out `otherFees` and recompute
 * `netProceeds` without it. Never touches a loan whose `otherFees` does NOT match that sum - those
 * are a different, not-yet-understood discrepancy (see session log) and need manual review, not a
 * guessed fix.
 *
 * Usage:
 *   npx tsx scripts/backfill-remove-duplicate-other-fees.ts          # dry run
 *   npx tsx scripts/backfill-remove-duplicate-other-fees.ts --apply  # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

async function main() {
  const loans = await prisma.loanAccount.findMany({
    where: { otherFees: { gt: 0 } },
    select: {
      id: true,
      loanCode: true,
      principalAmount: true,
      processingFee: true,
      advanceInterestFee: true,
      outstandingBalancePayoff: true,
      docStampFee: true,
      accountManagementFee: true,
      otherFees: true,
      notarialFee: true,
      webFee: true,
      insuranceFee: true,
      netProceeds: true,
    },
  });

  console.log(`=== Remove duplicate "Other Fees" (${APPLY ? 'APPLY' : 'dry run'}) ===`);
  console.log(`${loans.length} loan(s) with otherFees > 0.\n`);

  let matched = 0;
  let mismatched = 0;
  const mismatchedRows: typeof loans = [];

  for (const loan of loans) {
    const expectedOtherFees = Number(loan.notarialFee) + Number(loan.webFee) + Number(loan.insuranceFee);
    const isMatch = Math.abs(Number(loan.otherFees) - expectedOtherFees) < 0.01;

    if (!isMatch) {
      mismatched++;
      mismatchedRows.push(loan);
      continue;
    }

    matched++;
    const feesExcludingOther =
      Number(loan.processingFee) +
      Number(loan.advanceInterestFee) +
      Number(loan.outstandingBalancePayoff) +
      Number(loan.docStampFee) +
      Number(loan.accountManagementFee) +
      Number(loan.notarialFee) +
      Number(loan.webFee) +
      Number(loan.insuranceFee);
    const newNetProceeds = Number(loan.principalAmount) - feesExcludingOther;

    console.log(`  ${loan.loanCode}: otherFees ${loan.otherFees} -> 0, netProceeds ${loan.netProceeds} -> ${newNetProceeds.toFixed(2)}`);

    if (APPLY) {
      await prisma.loanAccount.update({
        where: { id: loan.id },
        data: { otherFees: 0, netProceeds: newNetProceeds },
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Matched (otherFees = notarial+web+insurance, ${APPLY ? 'fixed' : 'would fix'}): ${matched}`);
  console.log(`Mismatched (otherFees does NOT equal that sum - left untouched, needs manual review): ${mismatched}`);

  if (mismatchedRows.length > 0) {
    console.log('\nMismatched rows:');
    for (const loan of mismatchedRows) {
      const sum = Number(loan.notarialFee) + Number(loan.webFee) + Number(loan.insuranceFee);
      console.log(`  ${loan.loanCode}: otherFees=${loan.otherFees}  notarial+web+insurance=${sum.toFixed(2)}`);
    }
  }

  if (!APPLY) {
    console.log('\nDRY RUN ONLY - no changes written. Re-run with --apply to write these changes.');
  }
}

main().finally(() => process.exit(0));
