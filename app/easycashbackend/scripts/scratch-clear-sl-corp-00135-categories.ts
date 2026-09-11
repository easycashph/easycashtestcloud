/* eslint-disable no-console */
/**
 * 2026-09-11 (user-reported: "hindi pa yata naka rename ang attachment"): AttachmentsPanel.tsx
 * shows `documentCategory`'s label INSTEAD of `fileName` whenever `documentCategory` is set (see
 * that component's own render logic) - 9 of SL-CORP_00135's 12 attachments were tagged
 * `OTHER_SUPPORTING_DOCUMENT`, which displays as the generic "Other" for all nine, completely
 * masking the fileName rename from earlier today. None of those nine have a real matching category
 * in `AttachmentDocumentCategory` (Application Form, Barangay Clearance, CMAP, Checklist,
 * Disbursement Letter, KYC, Selfie Photo, Signed Loan Documents), so clearing documentCategory to
 * null lets the UI fall back to the (already-renamed) fileName instead. PROOF_OF_BILLING and
 * VALID_ID_BORROWER are left as-is - their category labels already read fine.
 *
 * Usage:
 *   npx tsx scripts/scratch-clear-sl-corp-00135-categories.ts            # dry run
 *   npx tsx scripts/scratch-clear-sl-corp-00135-categories.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log(`SL-CORP_00135 documentCategory clear — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const loan = await prisma.loanAccount.findFirst({ where: { loanCode: 'SL-CORP_00135' }, select: { id: true } });
  if (!loan) {
    console.log('SKIPPED - could not resolve LoanAccount SL-CORP_00135.');
    await prisma.$disconnect();
    return;
  }

  const attachments = await prisma.attachment.findMany({
    where: { ownerType: 'LOAN_ACCOUNT', ownerId: loan.id, documentCategory: 'OTHER_SUPPORTING_DOCUMENT' },
    select: { id: true, fileName: true },
  });

  for (const a of attachments) {
    console.log(`  ${a.fileName}  (OTHER_SUPPORTING_DOCUMENT -> null)`);
    if (APPLY) {
      await prisma.attachment.update({ where: { id: a.id }, data: { documentCategory: null } });
    }
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${attachments.length} attachment(s) ${APPLY ? 'updated' : 'would be updated'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
