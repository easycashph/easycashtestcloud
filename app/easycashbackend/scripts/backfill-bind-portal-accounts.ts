/**
 * Bind existing Client data to Portal (2026-08-06 user request): one-time sweep of PortalAccounts
 * created before the auto-bind-at-signup / staff-bind features existed - clients who already
 * signed up on the Portal using their real client (Borrower) email, but whose account was never
 * linked (`PortalAccount.borrowerId` still null).
 *
 * Matching rule (explicit user decision): `Borrower.email` has no uniqueness constraint, so a
 * PortalAccount's email matching 0 Borrowers is skipped (genuinely new client, nothing to bind),
 * matching exactly 1 is bound automatically, and matching 2+ is left alone and logged for manual
 * review via the staff-facing "Bind Existing Portal Account" action - never guessed. Uses the same
 * `matchBorrowerByEmail` helper as the signup auto-bind path (VerifySignUpUseCase), so both stay
 * consistent.
 *
 * Idempotent: only ever queries `PortalAccount`s with `borrowerId: null`, so a bound account is
 * never revisited on a re-run. Never writes to Borrower - only sets PortalAccount.borrowerId.
 *
 * Usage: npx tsx scripts/backfill-bind-portal-accounts.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';
import { PrismaBorrowerRepository } from '../src/modules/borrower/infrastructure/PrismaBorrowerRepository';
import { matchBorrowerByEmail } from '../src/modules/borrower/application/services/MatchBorrowerByEmail';

const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  console.log(`=== Backfill: bind unlinked Portal accounts to existing Clients by email ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const borrowerRepository = new PrismaBorrowerRepository();
  const unlinkedAccounts = await prisma.portalAccount.findMany({
    where: { borrowerId: null },
    select: { id: true, email: true },
  });

  console.log(`Unlinked Portal accounts to check: ${unlinkedAccounts.length}`);

  let bound = 0;
  let skippedNoMatch = 0;
  let skippedAmbiguous = 0;
  let skippedBorrowerAlreadyLinked = 0;

  for (const account of unlinkedAccounts) {
    const match = await matchBorrowerByEmail(borrowerRepository, account.email);

    if (match.outcome === 'none') {
      skippedNoMatch += 1;
      continue;
    }

    if (match.outcome === 'ambiguous') {
      console.log(`  AMBIGUOUS: ${account.email} matches ${match.borrowerIds.length} Borrowers (${match.borrowerIds.join(', ')}) — skipped, needs manual review`);
      skippedAmbiguous += 1;
      continue;
    }

    const alreadyLinked = await prisma.portalAccount.findUnique({ where: { borrowerId: match.borrower.id }, select: { id: true } });
    if (alreadyLinked) {
      console.log(`  SKIPPED: ${account.email} matched Borrower ${match.borrower.id}, which already has a different linked Portal account`);
      skippedBorrowerAlreadyLinked += 1;
      continue;
    }

    console.log(`  BIND: ${account.email} -> Borrower ${match.borrower.id} (${match.borrower.name.fullName()})`);
    if (!DRY_RUN) {
      await prisma.portalAccount.update({ where: { id: account.id }, data: { borrowerId: match.borrower.id } });
    }
    bound += 1;
  }

  console.log(`\nBound: ${bound}  No match: ${skippedNoMatch}  Ambiguous: ${skippedAmbiguous}  Borrower already linked elsewhere: ${skippedBorrowerAlreadyLinked}`);
  if (DRY_RUN) console.log('(dry run - no writes were made)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
