/* eslint-disable no-console */
/**
 * 2026-09-11 (user request, "8 AUGUST 2026" loan-releases review): renames SML-REG_00385's
 * (Nelson Malinao) attachments to clean, consistent display names, dropping the redundant
 * "Malinao -" prefix and inconsistent "(1)"/"(2)" suffixes. Every file's content was opened and
 * confirmed to match its label before renaming (see session log).
 *
 * Two things deliberately left as-is:
 *   - "Proof of Billing" is a Maynilad bill under "GEORGE MALINAO", not Nelson - plausibly a
 *     relative at the same address (2016 San Roque St, Baesa QC matches Nelson's own application
 *     form address) rather than a misattachment, but flagged for the user rather than assumed.
 *   - "Signed Loan Documents (Blank Template)" is a genuinely different document from the
 *     individually-filed Data Privacy/Deed/Disclosure/Loan Agreement/Manulife/Promissory Note
 *     files - a pre-signed BLANK template bundle, not a duplicate of the completed ones.
 *
 * Usage:
 *   npx tsx scripts/scratch-rename-malinao-00385-attachments.ts            # dry run
 *   npx tsx scripts/scratch-rename-malinao-00385-attachments.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const LOAN_CODE = 'SML-REG_00385';

const RENAMES: Record<string, string> = {
  'Checklist_SML-REG_00385_NELSON_ROXAS_MALINAO_082626': 'Checklist',
  'Malinao - Allotment Slip': 'Allotment Slip',
  'Malinao - CRM REPORT': 'CRM Report',
  'Malinao - Contract': 'Contract',
  'Malinao - Copy of SIGNED LOAN DOCUMENTS (BLANK)': 'Signed Loan Documents (Blank Template)',
  'Malinao - Data Privacy': 'Data Privacy and Consent Form',
  'Malinao - Deeds (1)': 'Deed of Assignment',
  'Malinao - Disbursement Letter': 'Disbursement Letter',
  'Malinao - Disclosure (1)': 'Disclosure Statement',
  'Malinao - Flight details': 'Flight Details',
  'Malinao - Loan Agreement(2)': 'Loan Agreement',
  'Malinao - Loan Application': 'Loan Application',
  'Malinao - Manulife (1)': 'Manulife',
  'Malinao - OEC': 'OEC',
  'Malinao - PN(2)': 'Promissory Note',
  'Malinao - Passport': 'Passport',
  'Malinao - Proof of Billing': 'Proof of Billing',
  'Malinao - Seamans Book ID with 3 specimen signature': 'Seamans Book',
  'Malinao - Selfie Photo': 'Selfie Photo (Authorization)',
  'Malinao - Ticket': 'Flight Ticket',
  'Malinao - Valid ID Co Borrower': 'Valid ID (Co-borrower)',
  'Malinao - Visa': 'Visa',
};

async function main(): Promise<void> {
  console.log(`${LOAN_CODE} attachment rename — mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);

  const loan = await prisma.loanAccount.findFirst({ where: { loanCode: LOAN_CODE }, select: { id: true } });
  if (!loan) {
    console.log('SKIPPED - could not resolve LoanAccount.');
    await prisma.$disconnect();
    return;
  }

  const attachments = await prisma.attachment.findMany({
    where: { ownerType: 'LOAN_ACCOUNT', ownerId: loan.id },
    select: { id: true, fileName: true },
  });

  let renamed = 0;
  for (const a of attachments) {
    const newName = RENAMES[a.fileName.trim()];
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
