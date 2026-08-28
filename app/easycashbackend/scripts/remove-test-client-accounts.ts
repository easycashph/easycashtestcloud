/* eslint-disable no-console */
/**
 * 2026-08-28 (user request): permanently removes 5 specific legacy-migrated test/dummy client
 * accounts spotted by the user in the Client List ("DEVELOPER TEST ACCOUNT", "KABORROW T TESTING",
 * "TEST ACCOUNT PAYLATER", "EASYCASH TEST ACCOUNT", "JAY LLLL TEST") - not real clients, all carry
 * a `legacyId` (imported from SDevTech's own internal test data), confirmed via a live-DB check
 * before writing this: EASYCASH TEST ACCOUNT's 3 loan accounts are all PENDING_APPROVAL (never
 * activated - no real disbursement/collection activity), the rest have zero loans at all.
 *
 * `LoanAccount.borrower` has no onDelete cascade (deliberately - a real borrower's loan history
 * must survive), so this deletes bottom-up: loan transactions/schedules -> loan accounts -> the
 * polymorphic-owner rows (attachments/notes, ownerType BORROWER or LOAN_ACCOUNT, not FK-cascaded
 * since ownerId isn't a real foreign key) -> portal accounts -> the borrowers themselves. Every
 * other Borrower-owned table (income detail, government ID, addresses, character references) IS
 * `onDelete: Cascade` in the schema, so those clean up automatically when the borrower row goes.
 *
 * One-off, not a general reusable backfill - matches by exact first/middle/last name (not
 * hardcoded UUIDs), so it still resolves correctly after a full re-migration without needing any
 * IDs updated.
 *
 * Usage:
 *   npx tsx scripts/remove-test-client-accounts.ts            # dry run - reports only
 *   npx tsx scripts/remove-test-client-accounts.ts --apply    # permanently deletes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log(`Test client account removal — mode: ${APPLY ? 'APPLY (permanently deleting)' : 'DRY RUN (no writes)'}`);

  const borrowers = await prisma.borrower.findMany({
    where: {
      OR: [
        { firstName: 'DEVELOPER', middleName: 'TEST', lastName: 'ACCOUNT' },
        { firstName: 'KABORROW', middleName: 'T', lastName: 'TESTING' },
        { firstName: 'TEST', middleName: 'ACCOUNT', lastName: 'PAYLATER' },
        { firstName: 'EASYCASH', middleName: 'TEST', lastName: 'ACCOUNT' },
        { firstName: 'JAY', middleName: 'LLLL', lastName: 'TEST' },
        { firstName: 'ROXANNE', middleName: 'EBIA', lastName: 'TESTONLY' },
      ],
    },
    select: { id: true, firstName: true, middleName: true, lastName: true, legacyId: true },
  });

  console.log(`Matched ${borrowers.length} account(s) still remaining out of 6 known test names (already-deleted ones simply won't match):`);
  for (const b of borrowers) console.log(`  ${b.firstName} ${b.middleName ?? ''} ${b.lastName} (legacyId ${b.legacyId})`);
  if (borrowers.length === 0) return;

  for (const b of borrowers) {
    const loans = await prisma.loanAccount.findMany({ where: { borrowerId: b.id }, select: { id: true, loanCode: true, status: true } });
    const [portalCount, noteCount, attachCount] = await Promise.all([
      prisma.portalAccount.count({ where: { borrowerId: b.id } }),
      prisma.profileNote.count({ where: { ownerType: 'BORROWER', ownerId: b.id } }),
      prisma.attachment.count({ where: { ownerType: 'BORROWER', ownerId: b.id } }),
    ]);
    console.log(
      `\n${b.firstName} ${b.middleName ?? ''} ${b.lastName} (${b.id}) - ${loans.length} loan(s), ${portalCount} portal account(s), ${noteCount} note(s), ${attachCount} attachment(s)`,
    );
    for (const l of loans) console.log(`    loan ${l.loanCode} (${l.status})`);
  }

  if (!APPLY) {
    console.log('\nDry run only - no writes made. Re-run with --apply to permanently delete these accounts.');
    return;
  }

  console.log('\nDeleting...');
  await prisma.$transaction(async (tx) => {
    for (const b of borrowers) {
      const loans = await tx.loanAccount.findMany({ where: { borrowerId: b.id }, select: { id: true } });
      const loanIds = loans.map((l) => l.id);

      if (loanIds.length > 0) {
        await tx.loanTransaction.deleteMany({ where: { loanAccountId: { in: loanIds } } });
        await tx.repaymentSchedule.deleteMany({ where: { loanAccountId: { in: loanIds } } });
        await tx.attachment.deleteMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId: { in: loanIds } } });
        await tx.profileNote.deleteMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId: { in: loanIds } } });
        await tx.loanAccount.deleteMany({ where: { id: { in: loanIds } } });
      }

      await tx.attachment.deleteMany({ where: { ownerType: 'BORROWER', ownerId: b.id } });
      await tx.profileNote.deleteMany({ where: { ownerType: 'BORROWER', ownerId: b.id } });
      await tx.portalAccount.deleteMany({ where: { borrowerId: b.id } });
      await tx.borrower.delete({ where: { id: b.id } });
      console.log(`  Deleted ${b.firstName} ${b.middleName ?? ''} ${b.lastName}.`);
    }
  });

  console.log(`\nDone. ${borrowers.length} test account(s) permanently removed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
