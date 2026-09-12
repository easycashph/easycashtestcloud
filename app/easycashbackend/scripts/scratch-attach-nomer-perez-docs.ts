/* eslint-disable no-console */
/**
 * 2026-09-12 (user request): NOMER DELA CRUZ PEREZ (LoanApplication 7d8f7f7b, Salary Loan, no
 * co-borrower) has zero attachments and no monthlyIncome on record - genuinely INCOMPLETE test
 * data, not a bug (see SESSION_LOG_2026-09-12_loan_application_risk_backfill.md). User asked to
 * attach 5 placeholder documents covering every category getRequiredDocumentCategories lists for
 * a Salary Loan, so this test application can reach Requirement Compliance (PREAPPROVED) the same
 * way a real one would.
 *
 * Generates 5 tiny, clearly-labeled placeholder PDFs with pdf-lib (already a dependency) rather
 * than sourcing or fabricating real ID/payslip content - this is dummy test data, plainly marked
 * as such in the PDF text itself and in the stored fileName.
 *
 * Deliberately does NOT set a monthlyIncome - the user asked only for the 5 documents. This
 * application has none on record, so (matching scratch-backfill-loan-application-risk.ts's same
 * rule) DTI/riskTier stay blank even once this makes it PREAPPROVED/PREDECLINED - never fabricated.
 *
 * Usage:
 *   npx tsx scripts/scratch-attach-nomer-perez-docs.ts            # dry run
 *   npx tsx scripts/scratch-attach-nomer-perez-docs.ts --apply    # writes
 */
import 'dotenv/config';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';
import { getRequiredDocumentCategories, isDocumentComplete } from '../src/modules/loan-application/application/config/requiredDocumentCategories';
import { assessLoanApplicationRisk } from '../src/modules/loan-application/application/services/LoanApplicationRiskAssessmentService';
import { LoanApplicationPreQualificationService } from '../src/modules/loan-application/application/services/LoanApplicationPreQualificationService';
import type { AttachmentDocumentCategory } from '../src/modules/document/application/ports/IAttachmentRepository';

const APPLY = process.argv.includes('--apply');
const APPLICATION_ID = '7d8f7f7b-c13f-4f90-968e-a5b4a7db930f';

const CATEGORY_LABELS: Partial<Record<AttachmentDocumentCategory, string>> = {
  VALID_ID_BORROWER: 'Valid ID (Borrower)',
  PROOF_OF_BILLING: 'Proof of Billing',
  EMPLOYEE_ID: 'Employee ID',
  CORPORATE_PAYSLIP: 'Corporate Payslip',
  CERTIFICATE_OF_EMPLOYMENT: 'Certificate of Employment',
};

async function makePlaceholderPdf(category: AttachmentDocumentCategory, applicantName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 260]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const label = CATEGORY_LABELS[category] ?? category;
  page.drawText('TEST / PLACEHOLDER DOCUMENT', { x: 30, y: 200, size: 14, font, color: rgb(0.7, 0, 0) });
  page.drawText(label, { x: 30, y: 160, size: 18, font });
  page.drawText(applicantName, { x: 30, y: 120, size: 12, font });
  page.drawText('No real document - dummy test data only', { x: 30, y: 40, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  return doc.save();
}

async function main(): Promise<void> {
  console.log(`Attach placeholder documents (Nomer Perez test application) — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

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

  const required = getRequiredDocumentCategories(app.requestedCategory, Boolean(app.coBorrowerFirstName || app.coBorrowerName));
  console.log(`Required categories for "${app.requestedCategory}": ${required.join(', ')}`);

  const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
  for (const category of required) {
    console.log(`  Would attach placeholder for: ${CATEGORY_LABELS[category] ?? category}`);
    if (APPLY) {
      const bytes = await makePlaceholderPdf(category, app.applicantName);
      const storageKey = path.posix.join('loan_application', APPLICATION_ID, `${randomUUID()}.pdf`);
      await storage.save(storageKey, Buffer.from(bytes));
      await prisma.attachment.create({
        data: {
          ownerType: 'LOAN_APPLICATION',
          ownerId: APPLICATION_ID,
          fileName: `${CATEGORY_LABELS[category] ?? category} (placeholder)`,
          fileType: '.pdf',
          storageKey,
          fileSize: bytes.length,
          documentCategory: category,
        },
      });
    }
  }

  if (APPLY) {
    const attachments = await prisma.attachment.findMany({ where: { ownerType: 'LOAN_APPLICATION', ownerId: APPLICATION_ID } });
    const complete = isDocumentComplete(required, attachments.map((a) => a.documentCategory));
    console.log(`  Document completeness after attach: ${complete}`);

    if (complete) {
      const monthlyIncome = app.monthlyIncome ? Number(app.monthlyIncome) : undefined;
      if (!monthlyIncome) console.log('  Note: no monthlyIncome on record - DTI/riskTier will stay blank, not fabricated.');
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
      console.log(`  New status: ${breakdown.status}${risk ? `, DTI ${risk.dtiPercent.toFixed(1)}%, ${risk.riskTier}` : ' (DTI not computable)'}`);
    }
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${required.length} placeholder document(s) ${APPLY ? 'attached' : 'would be attached'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
