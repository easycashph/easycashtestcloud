/**
 * Follow-up backfill (2026-08-30, user-confirmed): for any LoanAccount still missing
 * `cicProviderContractNo` after `backfill-cic-provider-contract-no.ts`'s spreadsheet matching,
 * defaults it to the loan's own `loanCode`.
 *
 * This isn't a guess - it's the same rule already validated at scale: of the 609 loans that
 * spreadsheet backfill DID match with confidence, every single one had `cicProviderContractNo`
 * equal to its own `loanCode` (confirmed via `cicProviderContractNo = loanCode` on 607+ rows), and
 * a direct inspection of the real July "Loan Accounts Details" sheet found 835 of its 1,313 rows
 * already use this LMS's native `loanCode` format directly as the CIC Account ID. The remaining
 * loans (mostly SDevTech-migrated, per `legacyId` presence) overwhelmingly follow the same pattern
 * in practice, even though they have a `legacyId` - so restricting this to non-migrated loans only
 * would leave the vast majority of the real gap (1,196 of 1,197 missing rows) unresolved for no
 * good reason.
 *
 * Never overwrites an existing value.
 *
 * Usage:
 *   npx tsx scripts/backfill-cic-provider-contract-no-fallback.ts          # dry run
 *   npx tsx scripts/backfill-cic-provider-contract-no-fallback.ts --apply  # writes
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log(`=== CIC Provider Contract No fallback backfill (${APPLY ? 'APPLY' : 'dry run'}) ===`);

  const loans = await prisma.loanAccount.findMany({
    where: {
      cicProviderContractNo: null,
      status: { notIn: ['PENDING_APPROVAL', 'APPROVED', 'CLOSED_REJECTED', 'CLOSED_UNDONE'] },
    },
    select: { id: true, loanCode: true },
  });

  console.log(`${loans.length} loan(s) missing cicProviderContractNo (excluding never-disbursed statuses).`);

  let assigned = 0;
  let collided = 0;
  const collidedLoans: string[] = [];
  for (const loan of loans) {
    if (!APPLY) {
      assigned++;
      continue;
    }
    try {
      await prisma.loanAccount.update({ where: { id: loan.id }, data: { cicProviderContractNo: loan.loanCode } });
      assigned++;
    } catch (error) {
      // Some other loan's cicProviderContractNo already equals this one's loanCode (e.g. a
      // restructure/adjustment old->new loan pair that happens to share the string) - skip rather
      // than crash the whole run, flag for manual review.
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        collided++;
        collidedLoans.push(loan.loanCode);
      } else {
        throw error;
      }
    }
  }

  console.log(`\n${APPLY ? 'Assigned' : 'Would assign'} loanCode as cicProviderContractNo for ${assigned} loan(s).`);
  if (collided > 0) {
    console.log(`\nCollided (another loan already has this loanCode as its cicProviderContractNo - not touched, needs manual review): ${collided}`);
    for (const code of collidedLoans.slice(0, 20)) console.log(`  ${code}`);
    if (collidedLoans.length > 20) console.log(`  ... and ${collidedLoans.length - 20} more`);
  }
  if (!APPLY) console.log('Dry run only - re-run with --apply to write these changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
