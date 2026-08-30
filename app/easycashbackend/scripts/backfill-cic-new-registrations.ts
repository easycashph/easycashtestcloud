/**
 * One-time backfill (2026-08-30, user-confirmed after cross-checking every real historical CIC
 * submission on file - July 2026, June 2026, and all 12 real 2024 monthly files - zero matches):
 * assigns a fresh, permanent CIC identifier to borrowers/loans that are genuinely being submitted
 * to CIC for the first time, using the same `ELCS`/`ELCC` auto-generation this system already uses
 * for brand-new borrowers/loans (see Borrower.cicProviderSubjectNo / LoanAccount.cicProviderContractNo
 * schema doc comments) - just applied retroactively to existing records that predate this feature
 * rather than only at creation time.
 *
 * Scope: only borrowers/loans that are CURRENTLY excluded from the CIC monthly report for having
 * no permanent identifier at all - i.e. the exact set this script's own caller already verified
 * against every real historical submission. Never touches a record that already has a value.
 *
 * Usage:
 *   npx tsx scripts/backfill-cic-new-registrations.ts --year 2026 --month 8          # dry run
 *   npx tsx scripts/backfill-cic-new-registrations.ts --year 2026 --month 8 --apply  # writes
 */
import 'dotenv/config';
import { PrismaReportingRepository } from '../src/modules/reporting/infrastructure/PrismaReportingRepository';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const yearArg = process.argv.find((a) => a.startsWith('--year='));
const monthArg = process.argv.find((a) => a.startsWith('--month='));
const year = yearArg ? Number(yearArg.split('=')[1]) : new Date().getFullYear();
const month = monthArg ? Number(monthArg.split('=')[1]) : new Date().getMonth() + 1;

async function main(): Promise<void> {
  console.log(`=== CIC new-registration backfill for ${year}-${String(month).padStart(2, '0')} (${APPLY ? 'APPLY' : 'dry run'}) ===`);

  const repo = new PrismaReportingRepository();
  const data = await repo.getCicMonthlyReportData({ year, month });
  const missingSubject = data.skippedMissingSubjectNo.filter((s) => s.reason === 'MISSING_SUBJECT_NO');
  console.log(`${missingSubject.length} loan(s) currently excluded for a missing borrower CIC ID.`);

  let assigned = 0;
  for (const item of missingSubject) {
    const loan = await prisma.loanAccount.findFirst({ where: { loanCode: item.loanCode }, select: { id: true, borrowerId: true } });
    if (!loan) continue;
    console.log(`  ${item.loanCode} (${item.borrowerName})`);
    if (APPLY) {
      await prisma.$executeRaw`
        UPDATE "borrowers"
        SET "cicProviderSubjectNo" = 'ELCS' || lpad(nextval('cic_provider_subject_no_seq')::text, 9, '0')
        WHERE "id" = ${loan.borrowerId} AND "cicProviderSubjectNo" IS NULL
      `;
      await prisma.$executeRaw`
        UPDATE "loan_accounts"
        SET "cicProviderContractNo" = 'ELCC' || lpad(nextval('cic_provider_contract_no_seq')::text, 9, '0')
        WHERE "id" = ${loan.id} AND "cicProviderContractNo" IS NULL
      `;
    }
    assigned++;
  }

  console.log(`\n${APPLY ? 'Assigned' : 'Would assign'} fresh CIC identifiers for ${assigned} loan(s)/borrower(s).`);
  if (!APPLY) console.log('Dry run only - re-run with --apply to write these changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
