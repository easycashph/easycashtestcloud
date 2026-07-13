/* eslint-disable no-console */
/**
 * One-time cleanup: removes a specific TEST loan application (and the client/loan account it
 * produced, if any) so staff can re-run a full "Create Application → Create Client → Create Loan
 * Account" walkthrough without a stale TEST record blocking it (e.g. the unique
 * Borrower.sourceApplicationId constraint added 2026-07-12).
 *
 * Matches by name only - any LoanApplication.applicantName, or Borrower.firstName/lastName,
 * containing "TEST" (case-insensitive) - plus anything linked to a matched record (its created
 * Borrower/LoanAccount, or the LoanApplication a matched Borrower came from). Deletes in FK-safe
 * order: LoanTransaction/RepaymentSchedule/AppliedFee (no cascade - would FK-violate otherwise),
 * then LoanAccount (cascades LoanAccountCoBorrower), then polymorphic Attachment/Note/Address rows
 * by ownerId (no FK relation to cascade), then Borrower (cascades IdentificationDocument/
 * CharacterReference/BorrowerIncomeDetail/BorrowerGovernmentId), then the LoanApplication itself.
 * Deliberately does NOT touch AuditLog/ProfileActivityLog - audit history should outlive the data
 * it describes, per CLAUDE.md's audit-logging requirements.
 *
 * Usage:
 *   npx tsx scripts/delete-test-records.ts            # dry run - lists exactly what would be deleted
 *   npx tsx scripts/delete-test-records.ts --apply     # actually deletes, against the configured DATABASE_URL
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const applications = await prisma.loanApplication.findMany({
    where: { applicantName: { contains: 'TEST', mode: 'insensitive' } },
  });
  const borrowersByName = await prisma.borrower.findMany({
    where: {
      OR: [{ firstName: { contains: 'TEST', mode: 'insensitive' } }, { lastName: { contains: 'TEST', mode: 'insensitive' } }],
    },
  });

  const applicationIds = new Set(applications.map((a) => a.id));
  const borrowerIds = new Set(borrowersByName.map((b) => b.id));

  // Pull in anything linked the other direction: a matched application's own created borrower, or
  // a matched borrower's source application - so both halves of a TEST record always go together.
  const linkedBorrowers = await prisma.borrower.findMany({ where: { sourceApplicationId: { in: [...applicationIds] } } });
  for (const b of linkedBorrowers) borrowerIds.add(b.id);
  const linkedApplications = await prisma.loanApplication.findMany({
    where: { id: { in: borrowersByName.map((b) => b.sourceApplicationId).filter((id): id is string => Boolean(id)) } },
  });
  for (const a of linkedApplications) applicationIds.add(a.id);

  const borrowers = await prisma.borrower.findMany({ where: { id: { in: [...borrowerIds] } } });
  const loanAccounts = await prisma.loanAccount.findMany({ where: { borrowerId: { in: [...borrowerIds] } } });

  console.log(`Loan Applications matched (${applicationIds.size}):`);
  for (const a of applications.concat(linkedApplications)) {
    if (applicationIds.has(a.id)) console.log(`  - ${a.id}  "${a.applicantName}"  status=${a.status}`);
  }
  console.log(`\nBorrowers matched (${borrowers.length}):`);
  for (const b of borrowers) console.log(`  - ${b.id}  "${b.firstName} ${b.lastName}"`);
  console.log(`\nLoan Accounts matched (${loanAccounts.length}):`);
  for (const l of loanAccounts) console.log(`  - ${l.id}  ${l.loanCode}  status=${l.status}`);

  if (applicationIds.size === 0 && borrowers.length === 0) {
    console.log('\nNothing matched "TEST" - nothing to do.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry run only - re-run with --apply to actually delete the records listed above.');
    return;
  }

  const loanAccountIds = loanAccounts.map((l) => l.id);
  const finalBorrowerIds = borrowers.map((b) => b.id);
  const finalApplicationIds = [...applicationIds];

  await prisma.$transaction(async (tx) => {
    if (loanAccountIds.length > 0) {
      await tx.loanTransaction.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.repaymentSchedule.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.appliedFee.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.attachment.deleteMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId: { in: loanAccountIds } } });
      await tx.note.deleteMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId: { in: loanAccountIds } } });
      await tx.loanAccount.deleteMany({ where: { id: { in: loanAccountIds } } });
    }

    if (finalBorrowerIds.length > 0) {
      await tx.attachment.deleteMany({ where: { ownerType: 'BORROWER', ownerId: { in: finalBorrowerIds } } });
      await tx.note.deleteMany({ where: { ownerType: 'BORROWER', ownerId: { in: finalBorrowerIds } } });
      await tx.address.deleteMany({ where: { ownerType: 'BORROWER', ownerId: { in: finalBorrowerIds } } });
      await tx.borrower.deleteMany({ where: { id: { in: finalBorrowerIds } } });
    }

    if (finalApplicationIds.length > 0) {
      await tx.attachment.deleteMany({ where: { ownerType: 'LOAN_APPLICATION', ownerId: { in: finalApplicationIds } } });
      await tx.note.deleteMany({ where: { ownerType: 'LOAN_APPLICATION', ownerId: { in: finalApplicationIds } } });
      await tx.loanApplication.deleteMany({ where: { id: { in: finalApplicationIds } } });
    }
  });

  console.log('\nDeleted.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
