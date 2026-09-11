/* eslint-disable no-console */
/**
 * 2026-09-11 (user request, "8 AUGUST 2026" loan-releases review): renames SML-REG_00382's
 * (Aldwin Maniwang) attachments to clean, consistent display names - dropping the redundant
 * "Maniwang -"/"SML-REG_00382 - Aldwin Jala Maniwang -" prefixes. Every file's content was opened
 * and confirmed to match its label before renaming (see session log). Deliberately excludes:
 *   - 3 confirmed-misattached files (belong to other clients/loans entirely) - left untouched,
 *     user's explicit call not to remove/rename them without further review.
 *   - Duplicate pairs are kept (user's call: don't delete), each given a distinguishing "(2)"/"(3)"
 *     suffix rather than an identical name, so they stay distinguishable in the Attachments list.
 *
 * Usage:
 *   npx tsx scripts/scratch-rename-maniwang-00382-attachments.ts            # dry run
 *   npx tsx scripts/scratch-rename-maniwang-00382-attachments.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const LOAN_CODE = 'SML-REG_00382';

const RENAMES: Record<string, string> = {
  Checklist_SML_REG_00382_ALDWIN_JALA_MANIWANG_082526: 'Checklist',
  'Maniwang - Allotment Slip': 'Allotment Slip',
  'Maniwang - CRM Report': 'CRM Report',
  'Maniwang - Contract': 'Contract',
  'Maniwang - Flight Details_': 'Flight Details',
  'Maniwang - Loan Application - Back': 'Loan Application (Back)',
  'Maniwang - Loan Application - Front': 'Loan Application (Front)',
  'Maniwang - OEC': 'OEC',
  'Maniwang - Passport': 'Passport',
  'Maniwang - Seamans Book': 'Seamans Book',
  'Maniwang - Seamans Book (1)': 'Seamans Book (2)',
  'Maniwang - Selfie Co-borrower': 'Selfie Photo (Co-borrower)',
  'Maniwang - Selfie Photo': 'Selfie Photo',
  'Maniwang - Selfie Photo - Authorization': 'Selfie Photo - Authorization',
  'Maniwang - Selfie Photo - Authorization_': 'Selfie Photo - Authorization (2)',
  'Maniwang - Utility Billing': 'Utility Billing',
  'SML-REG_00382 - Aldwin Jala Maniwang - Acknowledgement Receipt': 'Acknowledgement Receipt',
  'SML-REG_00382 - Aldwin Jala Maniwang - Data Privacy and Consent Form': 'Data Privacy and Consent Form',
  'SML-REG_00382 - Aldwin Jala Maniwang - Deed of Assignment': 'Deed of Assignment',
  'SML-REG_00382 - Aldwin Jala Maniwang - Disclosure Statement': 'Disclosure Statement',
  'SML-REG_00382 - Aldwin Jala Maniwang - Loan Agreement': 'Loan Agreement',
  'SML-REG_00382 - Aldwin Jala Maniwang - Manulife': 'Manulife',
  'SML-REG_00382 - Aldwin Jala Maniwang - Promissory Note': 'Promissory Note',
};

// Valid ID Co-borrower has 3 duplicate copies with an IDENTICAL fileName ("Maniwang - Valid ID Co
// borrower" / "Maniwang - Valid ID Co borrower (1)") - disambiguated here by storageKey's file
// extension order (.jpg, then the two .png's) since RENAMES can't key on duplicate strings.
const VALID_ID_RENAMES = ['Valid ID (Co-borrower)', 'Valid ID (Co-borrower) (2)', 'Valid ID (Co-borrower) (3)'];

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
    select: { id: true, fileName: true, storageKey: true },
    orderBy: { storageKey: 'asc' },
  });

  let renamed = 0;
  let validIdIndex = 0;
  for (const a of attachments) {
    let newName: string | undefined;
    const trimmedName = a.fileName.trim();
    if (trimmedName.includes('Valid ID Co borrower')) {
      newName = VALID_ID_RENAMES[validIdIndex];
      validIdIndex += 1;
    } else {
      const key = trimmedName.replace(/-/g, '_');
      newName = RENAMES[trimmedName] ?? RENAMES[key];
    }
    if (!newName) {
      console.log(`  SKIPPED (no mapping - likely a misattached file, left as-is): ${a.fileName}`);
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
