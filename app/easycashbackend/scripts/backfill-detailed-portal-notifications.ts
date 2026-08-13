/**
 * Rewrite existing PortalNotification rows to the new "detailed" title format (2026-08-14 user
 * request) - ApproveLoanApplicationUseCase/DeclineLoanApplicationUseCase used to write a bare
 * `Approved: {applicantName}` / `Declined: {applicantName}` title; they now write
 * `LOAN APPLICATION APPROVED: {applicantName}'s application has been approved by {reviewer}` (and
 * the DECLINED equivalent). This is a one-time rewrite of rows already sent before that change
 * shipped, so old and new notifications read consistently in a client's bell dropdown.
 *
 * Only touches `APPLICATION_APPROVED`/`APPLICATION_DECLINED` rows whose title still matches the
 * OLD bare format (`^Approved: ` / `^Declined: `) - a row already in the new format (e.g. re-run,
 * or a notification sent after the fix shipped) is left untouched, so this is safe to re-run.
 * `LOAN_ACCOUNT_APPROVED`/`LOAN_ACCOUNT_DISBURSED`/`LOAN_ACCOUNT_REJECTED` never existed before
 * this fix, so there is nothing to backfill for them.
 *
 * The reviewer name is reconstructed from the LoanApplication's own persisted
 * `reviewedByUserId` (the real approver/decliner of record) - never guessed. A row whose
 * LoanApplication or reviewer no longer exists (deleted test data, etc.) is skipped and logged,
 * not silently given a fabricated name.
 *
 * If a row's `body` is identical to its OLD title (i.e. no real decisionNote was ever given -
 * see PortalNotificationService.notify's `body = input.body ?? input.title` fallback), the body
 * is rewritten to the same generic fallback text the use cases now write. A row with a genuine
 * staff-written decisionNote in `body` is left alone.
 *
 * Usage: npx tsx scripts/backfill-detailed-portal-notifications.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

const APPROVED_FALLBACK_BODY = 'Your loan application has been approved. Our team will reach out to complete the release of proceeds.';
const DECLINED_FALLBACK_BODY = "This application wasn't approved this time. You're welcome to apply again.";

async function main(): Promise<void> {
  console.log(`=== Backfill: detailed Portal notification titles ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const rows = await prisma.portalNotification.findMany({
    where: { type: { in: ['APPLICATION_APPROVED', 'APPLICATION_DECLINED'] } },
  });

  let rewritten = 0;
  let alreadyDetailed = 0;
  let skippedNoApplication = 0;
  let skippedNoReviewer = 0;

  for (const row of rows) {
    const isApproved = row.type === 'APPLICATION_APPROVED';
    const oldPrefix = isApproved ? 'Approved: ' : 'Declined: ';
    if (!row.title.startsWith(oldPrefix)) {
      alreadyDetailed += 1;
      continue;
    }

    if (row.entityType !== 'LoanApplication' || !row.entityId) {
      console.log(`  SKIP (no LoanApplication link): notification ${row.id}`);
      skippedNoApplication += 1;
      continue;
    }

    const application = await prisma.loanApplication.findUnique({
      where: { id: row.entityId },
      select: { applicantName: true, reviewedByUserId: true },
    });
    if (!application) {
      console.log(`  SKIP (LoanApplication ${row.entityId} no longer exists): notification ${row.id}`);
      skippedNoApplication += 1;
      continue;
    }

    const reviewer = application.reviewedByUserId
      ? await prisma.user.findUnique({ where: { id: application.reviewedByUserId }, select: { firstName: true, lastName: true } })
      : null;
    if (!reviewer) {
      console.log(`  SKIP (no resolvable reviewer for LoanApplication ${row.entityId}): notification ${row.id}`);
      skippedNoReviewer += 1;
      continue;
    }
    const reviewerName = `${reviewer.firstName} ${reviewer.lastName}`;

    const newTitle = isApproved
      ? `LOAN APPLICATION APPROVED: ${application.applicantName}'s application has been approved by ${reviewerName}`
      : `LOAN APPLICATION DECLINED: ${application.applicantName}'s application has been declined by ${reviewerName}`;

    // Only overwrite `body` if it was never a real decisionNote (i.e. it's just the old title
    // echoed back by PortalNotificationService's `body ?? title` fallback) - never clobber an
    // actual staff-written note.
    const bodyWasNeverSet = row.body === row.title;
    const newBody = bodyWasNeverSet ? (isApproved ? APPROVED_FALLBACK_BODY : DECLINED_FALLBACK_BODY) : row.body;

    console.log(`  REWRITE ${row.id}:`);
    console.log(`    title: "${row.title}" -> "${newTitle}"`);
    if (bodyWasNeverSet) console.log(`    body:  "${row.body}" -> "${newBody}"`);

    if (!DRY_RUN) {
      await prisma.portalNotification.update({ where: { id: row.id }, data: { title: newTitle, body: newBody } });
    }
    rewritten += 1;
  }

  console.log(
    `\nRewritten: ${rewritten}  Already detailed: ${alreadyDetailed}  Skipped (no application): ${skippedNoApplication}  Skipped (no reviewer): ${skippedNoReviewer}`,
  );
  if (DRY_RUN) console.log('(dry run - no writes were made)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
