/* eslint-disable no-console */
/**
 * 2026-09-11 (user request, "8 AUGUST 2026" loan-releases review): renames
 * SML-Co-Borrower_00097's (Aristotle Moreno) attachments to clean, consistent display names,
 * dropping the "Moreno -" and "SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno -" prefixes.
 * Every file's content was opened and confirmed to match its label before renaming (see session
 * log). All 27 attachments genuinely belong to this loan account - no misattachments, no
 * duplicates this time.
 *
 * One flagged-but-unchanged anomaly: "Proof of Billing" is a Meralco bill under "VICTOR DIZON
 * EUSEBIO", not Moreno or his co-borrower - address partially matches (M.H. Del Pilar St,
 * Tinajeros, Malabon), but the name is unrelated to either party on this loan, unlike the
 * Malinao case (same last name, plausible relative). Flagged for the user rather than assumed;
 * renamed only, not treated as a misattachment to remove.
 *
 * Usage:
 *   npx tsx scripts/scratch-rename-moreno-co00097-attachments.ts            # dry run
 *   npx tsx scripts/scratch-rename-moreno-co00097-attachments.ts --apply    # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const LOAN_CODE = 'SML-Co-Borrower_00097';

const RENAMES: Record<string, string> = {
  'Moreno - Allotment Slip': 'Allotment Slip',
  'Moreno - Application (Front)': 'Loan Application (Front)',
  'Moreno - CMAP Co-borrower': 'CMAP (Co-borrower)',
  'Moreno - CMAP_': 'CMAP',
  'Moreno - CRM Report': 'CRM Report',
  'Moreno - Contract': 'Contract',
  'Moreno - Flight Details_': 'Flight Details',
  'Moreno - MyScore': 'MyScore',
  'Moreno - Myscore Coborrower': 'MyScore (Co-borrower)',
  'Moreno - OEC': 'OEC',
  'Moreno - Proof of Billing': 'Proof of Billing',
  'Moreno - Selfie': 'Selfie Photo',
  'Moreno - Selfie - Co-borrower': 'Selfie Photo (Co-borrower)',
  'Moreno - Valid ID - Co-borrower': 'Valid ID (Co-borrower)',
  'Moreno -Application (Back)': 'Loan Application (Back)',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Acknowledgement Receipt': 'Acknowledgement Receipt',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Authorization Letter': 'Authorization Letter',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Bor & Cob Valid ID': 'Valid ID (Borrower & Co-borrower)',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Data Privacy and Consent Form': 'Data Privacy and Consent Form',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Deed of Assignment': 'Deed of Assignment',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Disclosure Statement': 'Disclosure Statement',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Loan Agreement': 'Loan Agreement',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Loan Application Form': 'Loan Application Form',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Manulife': 'Manulife',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Oversees Employment Certificate': 'Overseas Employment Certificate',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Promissory Note': 'Promissory Note',
  'SML-Co-Borrower_00097 - Aristotle Ador Dionisio Moreno - Special Power of Attorney': 'Special Power of Attorney',
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
