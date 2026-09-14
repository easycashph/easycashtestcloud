/* eslint-disable no-console */
/**
 * 2026-09-14 (user request): re-applies the new real-PMT-formula amortization estimate
 * (loanApplicationContractualRates.ts, commit 00cbce84) to every existing test loan application -
 * their dtiPercent/riskTier were computed under the old flat-rate approximation. Reuses the real
 * LoanApplicationPreQualificationService.evaluateCriteria() (pure, no I/O - now uses the real PMT
 * formula internally) rather than re-implementing the math, same convention as every other backfill
 * script this session. Deliberately does NOT touch `status` - these applications already carry
 * real, already-decided statuses (PREAPPROVED/INCOMPLETE); only the two informational fields are
 * refreshed.
 *
 * Usage:
 *   npx tsx scripts/scratch-recompute-dti-pmt-formula.ts            # dry run
 *   npx tsx scripts/scratch-recompute-dti-pmt-formula.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';
import { LoanApplicationPreQualificationService } from '../src/modules/loan-application/application/services/LoanApplicationPreQualificationService';
import { assessLoanApplicationRisk } from '../src/modules/loan-application/application/services/LoanApplicationRiskAssessmentService';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log(`Recompute DTI/risk with real PMT formula — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const applications = await prisma.loanApplication.findMany({
    select: {
      id: true,
      applicantName: true,
      status: true,
      monthlyIncome: true,
      requestedAmount: true,
      requestedTermMonths: true,
      requestedCategory: true,
      age: true,
      occupation: true,
      employer: true,
      dtiPercent: true,
      riskTier: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const preQualificationService = new LoanApplicationPreQualificationService({} as never);
  let updated = 0;
  let skipped = 0;

  for (const app of applications) {
    const monthlyIncome = app.monthlyIncome ? Number(app.monthlyIncome) : undefined;
    const breakdown = preQualificationService.evaluateCriteria({
      age: app.age ?? undefined,
      monthlyIncome,
      requestedAmount: Number(app.requestedAmount),
      requestedTermMonths: app.requestedTermMonths,
      requestedCategory: app.requestedCategory,
      occupation: app.occupation ?? undefined,
      employer: app.employer ?? undefined,
    });
    const risk = assessLoanApplicationRisk(monthlyIncome, breakdown.estimatedMonthlyAmortization);

    if (!risk) {
      console.log(`  SKIPPED (no monthlyIncome on record): ${app.applicantName} [${app.status}]`);
      skipped += 1;
      continue;
    }

    const oldDti = app.dtiPercent ? Number(app.dtiPercent) : null;
    console.log(
      `  ${app.applicantName} [${app.status}]  DTI ${oldDti !== null ? oldDti.toFixed(2) : '—'}% -> ${risk.dtiPercent.toFixed(2)}%, ` +
        `${app.riskTier ?? '—'} -> ${risk.riskTier}`,
    );

    if (APPLY) {
      await prisma.loanApplication.update({
        where: { id: app.id },
        data: { dtiPercent: risk.dtiPercent, riskTier: risk.riskTier },
      });
    }
    updated += 1;
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${updated} updated, ${skipped} skipped (no income).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
