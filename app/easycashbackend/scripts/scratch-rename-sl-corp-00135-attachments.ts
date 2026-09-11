/* eslint-disable no-console */
/**
 * 2026-09-11 (user request): renames the display fileName of SL-CORP_00135's 12 attachments -
 * dropping the redundant loan-code prefix (already implied by which loan account they're attached
 * to) and swapping underscores for spaces/proper casing, matching the cleaner naming convention
 * used for the September 2026 release attachments (see scratch-attach-september-releases.ts).
 * Metadata-only - storageKey/actual files are untouched.
 *
 * Usage:
 *   npx tsx scripts/scratch-rename-sl-corp-00135-attachments.ts            # dry run
 *   npx tsx scripts/scratch-rename-sl-corp-00135-attachments.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

const RENAMES: Record<string, string> = {
  SL_CORP_00135_Application_Form: 'Application Form',
  SL_CORP_00135_Brgy_Clearance: 'Barangay Clearance',
  SL_CORP_00135_CMAP: 'CMAP',
  SL_CORP_00135_COE: 'COE',
  SL_CORP_00135_Checklist: 'Checklist',
  SL_CORP_00135_KYC: 'KYC',
  SL_CORP_00135_MyScore: 'MyScore',
  SL_CORP_00135_Proof_of_Billing: 'Proof of Billing',
  SL_CORP_00135_Selfie_Photo: 'Selfie Photo',
  SL_CORP_00135_Signed_Loan_Docs: 'Signed Loan Documents',
  SL_CORP_00135_Valid_ID: 'Valid ID',
  SL_CORP_00135_Disbursement_Letter: 'Disbursement Letter',
};

function normalizedKey(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/-/g, '_');
}

async function main(): Promise<void> {
  console.log(`SL-CORP_00135 attachment rename — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const loan = await prisma.loanAccount.findFirst({ where: { loanCode: 'SL-CORP_00135' }, select: { id: true } });
  if (!loan) {
    console.log('SKIPPED - could not resolve LoanAccount SL-CORP_00135.');
    await prisma.$disconnect();
    return;
  }

  const attachments = await prisma.attachment.findMany({
    where: { ownerType: 'LOAN_ACCOUNT', ownerId: loan.id },
    select: { id: true, fileName: true },
  });

  let renamed = 0;
  for (const a of attachments) {
    const key = normalizedKey(a.fileName);
    const newName = RENAMES[key];
    if (!newName) {
      console.log(`  SKIPPED (no mapping): ${a.fileName}`);
      continue;
    }
    console.log(`  ${a.fileName}  ->  ${newName}`);
    if (APPLY) {
      await prisma.attachment.update({ where: { id: a.id }, data: { fileName: newName } });
    }
    renamed += 1;
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${renamed} attachment(s) ${APPLY ? 'renamed' : 'would be renamed'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
