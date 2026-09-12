/* eslint-disable no-console */
/**
 * 2026-09-12 (user request): "Test DELA CRUZ Applicant" (LoanApplication 811d7768) has a
 * co-borrower (TESTCOB) but was missing a VALID_ID_CO_BORROWER attachment, so
 * isDocumentComplete kept it INCOMPLETE even though all 7 other required Business Loan
 * categories were already uploaded. Confirmed this isn't a bug: the LMS Attachments panel
 * (AttachmentsPanel.tsx) has no category picker for an ALREADY-CREATED application - the
 * category-aware upload flow only exists on LoanApplicationCreatePage.tsx's initial creation
 * form (see its own comment: "editing an already-encoded application never touches documents").
 * Flagged to the user as a real product gap, separate from this one-off fix.
 *
 * Since this is test/dummy data (applicant literally named "Test DELA CRUZ Applicant"), reuses
 * the bytes of this same application's existing VALID_ID_BORROWER attachment as a placeholder
 * rather than fabricating or sourcing a real ID image - only the documentCategory differs.
 *
 * After this runs, RecheckLoanApplicationDocumentCompletenessUseCase's own logic (reproduced
 * inline here, not just this insert) fires the same way it would on a real upload, so the
 * application transitions INCOMPLETE -> PREAPPROVED/PREDECLINED immediately, matching what would
 * happen through the real API endpoint.
 *
 * Usage:
 *   npx tsx scripts/scratch-attach-cob-valid-id-811d7768.ts            # dry run
 *   npx tsx scripts/scratch-attach-cob-valid-id-811d7768.ts --apply    # writes
 */
import 'dotenv/config';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';
import { getRequiredDocumentCategories, isDocumentComplete } from '../src/modules/loan-application/application/config/requiredDocumentCategories';
import { assessLoanApplicationRisk } from '../src/modules/loan-application/application/services/LoanApplicationRiskAssessmentService';
import { LoanApplicationPreQualificationService } from '../src/modules/loan-application/application/services/LoanApplicationPreQualificationService';

const APPLY = process.argv.includes('--apply');
const APPLICATION_ID = '811d7768-fa43-4026-b070-840197c0f6a3';

async function main(): Promise<void> {
  console.log(`Attach placeholder Valid ID (Co-Borrower) — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const app = await prisma.loanApplication.findUnique({ where: { id: APPLICATION_ID } });
  if (!app) {
    console.log('SKIPPED - application not found.');
    await prisma.$disconnect();
    return;
  }
  if (app.status !== 'INCOMPLETE') {
    console.log(`SKIPPED - application is no longer INCOMPLETE (now ${app.status}).`);
    await prisma.$disconnect();
    return;
  }

  const sourceAttachment = await prisma.attachment.findFirst({
    where: { ownerType: 'LOAN_APPLICATION', ownerId: APPLICATION_ID, documentCategory: 'VALID_ID_BORROWER' },
  });
  if (!sourceAttachment) {
    console.log('SKIPPED - no VALID_ID_BORROWER attachment found to copy bytes from.');
    await prisma.$disconnect();
    return;
  }

  const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
  const buffer = await storage.read(sourceAttachment.storageKey);
  const ext = path.extname(sourceAttachment.storageKey);
  const newStorageKey = path.posix.join('loan_application', APPLICATION_ID, `${randomUUID()}${ext}`);

  console.log(`  Would copy ${sourceAttachment.fileName} (${buffer.length} bytes) -> new attachment, documentCategory: VALID_ID_CO_BORROWER`);

  if (APPLY) {
    await storage.save(newStorageKey, buffer);
    await prisma.attachment.create({
      data: {
        ownerType: 'LOAN_APPLICATION',
        ownerId: APPLICATION_ID,
        fileName: 'TESTCOB - Valid ID (Co-Borrower, placeholder)',
        fileType: sourceAttachment.fileType,
        storageKey: newStorageKey,
        fileSize: buffer.length,
        documentCategory: 'VALID_ID_CO_BORROWER',
      },
    });

    // Same recheck RecheckLoanApplicationDocumentCompletenessUseCase runs on every real upload.
    const required = getRequiredDocumentCategories(app.requestedCategory, Boolean(app.coBorrowerFirstName || app.coBorrowerName));
    const attachments = await prisma.attachment.findMany({ where: { ownerType: 'LOAN_APPLICATION', ownerId: APPLICATION_ID } });
    const complete = isDocumentComplete(required, attachments.map((a) => a.documentCategory));
    console.log(`  Document completeness after attach: ${complete}`);

    if (complete) {
      const monthlyIncome = app.monthlyIncome ? Number(app.monthlyIncome) : undefined;
      // evaluateCriteria() is pure (no I/O, never touches this.deps) - reused directly here
      // instead of re-implementing the age/income/employment rules by hand, so this script can
      // never silently drift from the real service's actual logic. Deps are only used by
      // classify()'s distance resolution, which this script doesn't call.
      const preQualificationService = new LoanApplicationPreQualificationService({} as never);
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
      await prisma.loanApplication.update({
        where: { id: APPLICATION_ID },
        data: { status: breakdown.status, dtiPercent: risk?.dtiPercent, riskTier: risk?.riskTier },
      });
      console.log(`  New status: ${breakdown.status}${risk ? `, DTI ${risk.dtiPercent.toFixed(1)}%, ${risk.riskTier}` : ''}`);
    }
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
