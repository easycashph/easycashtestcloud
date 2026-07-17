/**
 * Third, narrow-scope backfill pass for 3 specific loans (SML-REG_00377, SML-REG_00376,
 * SL-REG_00117) whose disbursement postdates both prior sources' coverage
 * (backfill-loan-origination-fees.ts / -mongo.ts). Investigated 2026-07-17 after the user asked
 * why these still had no processing fee.
 *
 * Source: raw `loan_transactions` (type=FEE_CHARGED) in the SDevTech MongoDB export
 * (legacy/MongoDB dump/.../loan_transactions.bson), joined to the loan by
 * loan_accounts._id == loan_transactions.parent_account_key. These transactions carry real
 * dollar amounts but NO fee-type label - unlike `monthly_loan_releases`. The fee-type mapping
 * below is INFERRED from a pattern confirmed exact (not approximate) across all 3 loans and
 * consistent with the 593 already-backfilled loans in this database:
 *   - Largest amount = Processing Fee
 *   - Second-largest = Account Management Fee (exactly 10-12.5% of Processing Fee, verified exact)
 *   - The two 500.00 amounts = Notarial Fee and Web Fee (constant across nearly every loan seen)
 *   - Remaining smallest = Insurance Fee
 * User reviewed this inference and approved applying it (2026-07-17) - flagged explicitly as
 * inferred, not an explicitly-labeled source field, per CLAUDE.md's Confirmed/Assumed distinction.
 *
 * A 4th loan in the original report (SML-QC_00027) has NO FEE_CHARGED transactions at all in the
 * source (still PENDING_APPROVAL in the Mambu snapshot) - genuinely no fee data exists yet,
 * intentionally left untouched (still 0).
 */
import { prisma } from '../src/shared/database/prismaClient';

const INFERRED: Record<string, { processingFee: number; accountManagementFee: number; notarialFee: number; webFee: number; insuranceFee: number }> = {
  'SML-REG_00377': { processingFee: 10291.24, accountManagementFee: 1029.12, notarialFee: 500, webFee: 500, insuranceFee: 592 },
  'SML-REG_00376': { processingFee: 13611.35, accountManagementFee: 1361.13, notarialFee: 500, webFee: 500, insuranceFee: 141 },
  'SL-REG_00117': { processingFee: 4518.68, accountManagementFee: 564.84, notarialFee: 500, webFee: 500, insuranceFee: 400 },
};

async function main() {
  const apply = process.argv.includes('--apply');

  for (const [loanCode, data] of Object.entries(INFERRED)) {
    const loan = await prisma.loanAccount.findUnique({ where: { loanCode }, select: { id: true, processingFee: true } });
    if (!loan) {
      console.log(`${loanCode}: NOT FOUND in our DB - skipping`);
      continue;
    }
    if (Number(loan.processingFee) !== 0) {
      console.log(`${loanCode}: already has fee data - skipping (not touched)`);
      continue;
    }
    console.log(`${loanCode}:`, data, apply ? '(applying)' : '(dry run)');
    if (apply) {
      await prisma.loanAccount.update({ where: { id: loan.id }, data });
    }
  }

  if (!apply) console.log('\nDRY RUN ONLY - no changes written. Re-run with --apply to write these changes.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
