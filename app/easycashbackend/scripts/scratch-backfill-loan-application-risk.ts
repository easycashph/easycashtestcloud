/* eslint-disable no-console */
/**
 * 2026-09-12 (user request: "i-apply ang DTI at RISK sa mga test account na nasa Loan
 * Applications"): the DTI/risk-tier feature (LoanApplicationRiskAssessmentService, shipped
 * 2026-09-12) only computes dtiPercent/riskTier at two points - CreateLoanApplicationUseCase (new
 * applications) and RecheckLoanApplicationDocumentCompletenessUseCase (INCOMPLETE -> PREAPPROVED/
 * PREDECLINED once documents complete). Every application that existed before the feature shipped,
 * or is already past INCOMPLETE, has no path to ever get these fields populated - none of the
 * domain's transition methods (applySystemClassification, completeDocuments) fit a pure backfill
 * without touching status, and status must NOT change here - these applications already have their
 * real, already-decided status (UNDER_REVIEW/PREDECLINED/APPROVED); this only fills in the two new
 * informational fields using the exact same formula the feature would have used had it existed
 * when they were created.
 *
 * Uses the same pure functions the feature itself uses - computeFlatRateAmortization (loan
 * amount/term/category only, no I/O) and assessLoanApplicationRisk (returns undefined when there's
 * no monthlyIncome on record - never guessed, per CLAUDE.md's "never fabricate financial logic").
 * Applications with no monthlyIncome are reported as un-computable, not defaulted to anything.
 *
 * Usage:
 *   npx tsx scripts/scratch-backfill-loan-application-risk.ts            # dry run
 *   npx tsx scripts/scratch-backfill-loan-application-risk.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';
import { computeFlatRateAmortization } from '../src/modules/loan-application/application/config/loanCategoryFlatRates';
import { assessLoanApplicationRisk } from '../src/modules/loan-application/application/services/LoanApplicationRiskAssessmentService';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log(`Loan Application DTI/risk backfill — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const applications = await prisma.loanApplication.findMany({
    where: { dtiPercent: null },
    select: {
      id: true,
      applicantName: true,
      status: true,
      monthlyIncome: true,
      requestedAmount: true,
      requestedTermMonths: true,
      requestedCategory: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  let updated = 0;
  let skippedNoIncome = 0;
  for (const app of applications) {
    const monthlyIncome = app.monthlyIncome ? Number(app.monthlyIncome) : undefined;
    const requestedAmount = Number(app.requestedAmount);
    const amortization = computeFlatRateAmortization(requestedAmount, app.requestedTermMonths, app.requestedCategory);
    const risk = assessLoanApplicationRisk(monthlyIncome, amortization);

    if (!risk) {
      console.log(`  SKIPPED (no monthlyIncome on record - cannot compute DTI): ${app.applicantName} [${app.status}]`);
      skippedNoIncome += 1;
      continue;
    }

    console.log(
      `  ${app.applicantName} [${app.status}]  ->  DTI ${risk.dtiPercent.toFixed(1)}%, ${risk.riskTier} ` +
        `(income ₱${monthlyIncome!.toFixed(2)} vs. est. ₱${amortization.toFixed(2)}/mo)`,
    );
    if (APPLY) {
      await prisma.loanApplication.update({
        where: { id: app.id },
        data: { dtiPercent: risk.dtiPercent, riskTier: risk.riskTier },
      });
    }
    updated += 1;
  }

  console.log(
    `\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${updated} application(s) ${APPLY ? 'updated' : 'would be updated'}, ${skippedNoIncome} skipped (no income on record).`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
