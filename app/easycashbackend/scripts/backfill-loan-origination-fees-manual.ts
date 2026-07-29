/**
 * Manual, user-confirmed fee entries — NOT derived from any legacy source record. Kept as a
 * permanent, idempotent audit record (mirrors the other backfill-loan-origination-fees-*.ts
 * scripts' pattern), distinct from those because this one is opinion/decision-based, not
 * data-recovery-based.
 *
 * SML-QC_00027 (product "SML-Quick Cash"): investigated exhaustively 2026-07-17 across every
 * legacy source available (monthly_loan_releases, loan_transactions of every type,
 * predefined_fee_amounts, custom_field_values, activities, repayments, the personal Excel LMS,
 * and a 2026-07-14 database snapshot) - no Notarial Fee record exists anywhere. The loan's own
 * product_fees configuration in the legacy system actually marks Notarial Fee as "NONE" for this
 * product. Despite that, the user explicitly confirmed 2026-07-17 that this loan should show
 * ₱500.00 Notarial Fee (the standard flat amount charged on nearly every other SML loan) and
 * asked for it to be entered directly - a manual business decision, not a data-recovery finding.
 */
import { prisma } from '../src/shared/database/prismaClient';

const MANUAL_ENTRIES: Record<string, Partial<{ notarialFee: number }>> = {
  'SML-QC_00027': { notarialFee: 500 },
};

async function main() {
  const apply = process.argv.includes('--apply');

  for (const [loanCode, data] of Object.entries(MANUAL_ENTRIES)) {
    const loan = await prisma.loanAccount.findUnique({ where: { loanCode }, select: { id: true, notarialFee: true } });
    if (!loan) {
      console.log(`${loanCode}: NOT FOUND in our DB - skipping`);
      continue;
    }
    console.log(`${loanCode}: current notarialFee=${loan.notarialFee}, setting to`, data, apply ? '(applying)' : '(dry run)');
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
