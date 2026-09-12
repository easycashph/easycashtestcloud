/* eslint-disable no-console */
/**
 * 2026-09-12 (user request: "lagyan mo ng income"): NOMER DELA CRUZ PEREZ (LoanApplication
 * 7d8f7f7b) had all 5 required documents attached (scratch-attach-nomer-perez-docs.ts) but landed
 * on Pre Declined since it had no monthlyIncome on record - the income check can never pass
 * without one. Sets ₱50,000/month, matching the same round test-income figure already used across
 * every other test application in this dataset (Test DELA CRUZ Applicant, TEST2NOMER, TEST6NOMER),
 * then reruns the real classification (LoanApplicationPreQualificationService.evaluateCriteria())
 * the same way a real intake edit would.
 *
 * Usage:
 *   npx tsx scripts/scratch-set-nomer-perez-income.ts            # dry run
 *   npx tsx scripts/scratch-set-nomer-perez-income.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';
import { LoanApplicationPreQualificationService } from '../src/modules/loan-application/application/services/LoanApplicationPreQualificationService';
import { assessLoanApplicationRisk } from '../src/modules/loan-application/application/services/LoanApplicationRiskAssessmentService';

const APPLY = process.argv.includes('--apply');
const APPLICATION_ID = '7d8f7f7b-c13f-4f90-968e-a5b4a7db930f';
const MONTHLY_INCOME = 40000;

async function main(): Promise<void> {
  console.log(`Set monthlyIncome (Nomer Perez test application) — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const app = await prisma.loanApplication.findUnique({ where: { id: APPLICATION_ID } });
  if (!app) {
    console.log('SKIPPED - application not found.');
    await prisma.$disconnect();
    return;
  }

  const preQualificationService = new LoanApplicationPreQualificationService({} as never);
  const breakdown = preQualificationService.evaluateCriteria({
    age: app.age ?? undefined,
    monthlyIncome: MONTHLY_INCOME,
    requestedAmount: Number(app.requestedAmount),
    requestedTermMonths: app.requestedTermMonths,
    requestedCategory: app.requestedCategory,
    occupation: app.occupation ?? undefined,
    employer: app.employer ?? undefined,
  });
  const risk = assessLoanApplicationRisk(MONTHLY_INCOME, breakdown.estimatedMonthlyAmortization);

  console.log(`  monthlyIncome: ₱${MONTHLY_INCOME.toFixed(2)}`);
  console.log(`  age check: ${breakdown.checks.age.detail}`);
  console.log(`  income check: ${breakdown.checks.income.detail}`);
  console.log(`  employment check: ${breakdown.checks.employment.detail}`);
  console.log(`  -> status: ${breakdown.status}${risk ? `, DTI ${risk.dtiPercent.toFixed(1)}%, ${risk.riskTier}` : ''}`);

  if (APPLY) {
    await prisma.loanApplication.update({
      where: { id: APPLICATION_ID },
      data: { monthlyIncome: MONTHLY_INCOME, status: breakdown.status, dtiPercent: risk?.dtiPercent, riskTier: risk?.riskTier },
    });
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
