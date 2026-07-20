/* eslint-disable no-console */
/**
 * One-time cleanup: removes a specific TEST loan application (and the client/loan account it
 * produced, if any) so staff can re-run a full "Create Application → Create Client → Create Loan
 * Account" walkthrough without a stale TEST record blocking it (e.g. the unique
 * Borrower.sourceApplicationId constraint added 2026-07-12).
 *
 * 2026-07-20: scoped to an explicit borrower-id allowlist (ONLY_BORROWER_IDS below) instead of a
 * blanket "name contains TEST" match - a dry run turned up 8 "TEST"-named borrowers on the real
 * database, only 3 of which the user actually asked to delete (TESToliver Tree, TESTmaximillan
 * Makaubo, TESTeveb Makalakad); the other 5 (ROXANNE TESTONLY, JAY TEST, BHENZII TESTA, TEST
 * PAYLATER, KABORROW TESTING) are untouched by design. Edit ONLY_BORROWER_IDS for a future
 * one-off cleanup rather than reverting to the old blanket name match.
 *
 * Matches the allowlisted Borrowers, plus anything linked to them (their created LoanAccount, and
 * the LoanApplication each came from via sourceApplicationId). Deletes in FK-safe order:
 * PaymentAllocation (references both LoanTransaction and RepaymentSchedule, RESTRICT both ways -
 * a real loan account with recorded payments has these and the delete would otherwise fail), then
 * LoanTransaction/RepaymentSchedule/AppliedFee (no cascade - would FK-violate otherwise), then
 * LoanAccount (cascades LoanAccountCoBorrower), then polymorphic Attachment/ProfileNote/Address
 * rows by ownerId (no FK relation to cascade), then Borrower (cascades IdentificationDocument/
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

const ONLY_BORROWER_IDS = [
  '71ea09de-6c2d-466c-b825-3c98ecd06e30', // TESTeveb Dy Makalakad
  'ac04e754-c598-426e-a28d-1aa2c7588ad9', // TESTmaximillan Dy Makaubo
  'b5602236-d3e6-4043-8df4-c85d7fb21eab', // TESToliver DY Tree
];

async function main(): Promise<void> {
  const borrowers = await prisma.borrower.findMany({ where: { id: { in: ONLY_BORROWER_IDS } } });

  // Each allowlisted Borrower's own source LoanApplication (sourceApplicationId) - so both halves
  // of a TEST record always go together.
  const applicationIds = new Set(borrowers.map((b) => b.sourceApplicationId).filter((id): id is string => Boolean(id)));
  const applications = await prisma.loanApplication.findMany({ where: { id: { in: [...applicationIds] } } });

  const loanAccounts = await prisma.loanAccount.findMany({ where: { borrowerId: { in: ONLY_BORROWER_IDS } } });

  console.log(`Loan Applications matched (${applications.length}):`);
  for (const a of applications) console.log(`  - ${a.id}  "${a.applicantName}"  status=${a.status}`);
  console.log(`\nBorrowers matched (${borrowers.length}):`);
  for (const b of borrowers) console.log(`  - ${b.id}  "${b.firstName} ${b.lastName}"`);
  console.log(`\nLoan Accounts matched (${loanAccounts.length}):`);
  for (const l of loanAccounts) console.log(`  - ${l.id}  ${l.loanCode}  status=${l.status}`);

  if (borrowers.length === 0) {
    console.log('\nNone of ONLY_BORROWER_IDS matched a real Borrower - nothing to do.');
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
      const transactionIds = (await tx.loanTransaction.findMany({ where: { loanAccountId: { in: loanAccountIds } }, select: { id: true } })).map(
        (t) => t.id,
      );
      const installmentIds = (
        await tx.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanAccountIds } }, select: { id: true } })
      ).map((i) => i.id);
      await tx.paymentAllocation.deleteMany({
        where: { OR: [{ loanTransactionId: { in: transactionIds } }, { repaymentInstallmentId: { in: installmentIds } }] },
      });
      await tx.penaltyReduction.deleteMany({ where: { repaymentInstallmentId: { in: installmentIds } } });
      await tx.feeAdjustment.deleteMany({ where: { repaymentInstallmentId: { in: installmentIds } } });
      await tx.smsReminderLog.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.emailReminderLog.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.generatedLoanDocument.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.loanNote.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.loanTransaction.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.repaymentSchedule.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.appliedFee.deleteMany({ where: { loanAccountId: { in: loanAccountIds } } });
      await tx.attachment.deleteMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId: { in: loanAccountIds } } });
      await tx.profileNote.deleteMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId: { in: loanAccountIds } } });
      await tx.loanAccount.deleteMany({ where: { id: { in: loanAccountIds } } });
    }

    if (finalBorrowerIds.length > 0) {
      await tx.attachment.deleteMany({ where: { ownerType: 'BORROWER', ownerId: { in: finalBorrowerIds } } });
      await tx.profileNote.deleteMany({ where: { ownerType: 'BORROWER', ownerId: { in: finalBorrowerIds } } });
      await tx.address.deleteMany({ where: { ownerType: 'BORROWER', ownerId: { in: finalBorrowerIds } } });
      await tx.borrower.deleteMany({ where: { id: { in: finalBorrowerIds } } });
    }

    if (finalApplicationIds.length > 0) {
      await tx.attachment.deleteMany({ where: { ownerType: 'LOAN_APPLICATION', ownerId: { in: finalApplicationIds } } });
      await tx.profileNote.deleteMany({ where: { ownerType: 'LOAN_APPLICATION', ownerId: { in: finalApplicationIds } } });
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
