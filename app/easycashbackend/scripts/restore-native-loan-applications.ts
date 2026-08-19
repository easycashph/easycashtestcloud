/**
 * 2026-08-19 (user request): restores whatever backup-native-loan-applications.ts saved right
 * before the reset, back into the freshly-migrated database. See that script's own doc comment for
 * the full reasoning and scope (LoanApplication rows + their native, non-legacy Attachment rows
 * only - explicitly not Borrower/LoanAccount or anything under them).
 *
 * Two things get remapped rather than restored verbatim, since a fresh migration regenerates them
 * with new ids:
 * - branchId -> the (single, "HQ") branch's new id. Bails out instead of guessing if more than one
 *   branch exists post-migration - this system has always been single-branch, but if that ever
 *   changes, blind remapping to "whichever branch" would silently misfile every restored
 *   application.
 * - Every staff user reference (encodedByUserId, reviewedByUserId, reviewStartedByUserId,
 *   preApprovedByUserId, Attachment.uploadedByUserId) -> null. Every User row is wiped by the
 *   reset too, and only a single fresh MIS bootstrap admin exists afterward - there is no
 *   meaningful old-id -> new-id mapping for "which staff member did this" to restore, so the
 *   historical name is lost rather than guessed at or pinned to the wrong (new) person.
 *
 * Only restores Attachment rows whose ownerType is LOAN_APPLICATION and whose ownerId is one of
 * the LoanApplication ids actually restored - a native Attachment on a BORROWER/LOAN_ACCOUNT is
 * out of scope (see the backup script) and would reference a row this script never recreates.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

const LOAN_APPLICATION_DATE_FIELDS = ['birthDate', 'reviewedAt', 'reviewStartedAt', 'preApprovedAt', 'createdAt', 'updatedAt'];
const ATTACHMENT_DATE_FIELDS = ['uploadedAt'];

function reviveDates<T extends Record<string, unknown>>(row: T, dateFields: string[]): T {
  const revived = { ...row };
  for (const field of dateFields) {
    if (typeof revived[field] === 'string') {
      (revived as Record<string, unknown>)[field] = new Date(revived[field] as string);
    }
  }
  return revived;
}

function findLatestBackup(): string | null {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('native-loan-applications-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(BACKUP_DIR, files[0]!) : null;
}

async function main() {
  const backupPath = findLatestBackup();
  if (!backupPath) {
    console.log('Walang nahanap na native-loan-applications backup - walang irerestore.');
    return;
  }
  console.log(`Gagamitin: ${backupPath}`);

  const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as {
    loanApplications: Record<string, unknown>[];
    attachments: Record<string, unknown>[];
  };

  if (payload.loanApplications.length === 0 && payload.attachments.length === 0) {
    console.log('Walang laman ang backup na ito - walang irerestore.');
    return;
  }

  const branches = await prisma.branch.findMany({ select: { id: true, code: true } });
  if (branches.length !== 1) {
    console.error(
      `X May ${branches.length} branch(es) sa database (inaasahan ay 1) - kinakansela ang restore para hindi mali ang pagkaka-remap ng branchId.`,
    );
    console.error('  Patakbuhin manually ang restore kung sadyang tama ang setup na ito (i-edit ang script).');
    process.exitCode = 1;
    return;
  }
  const newBranchId = branches[0]!.id;

  const [existingBorrowerIds, existingProductVersionIds, existingPortalAccountIds] = await Promise.all([
    prisma.borrower.findMany({ select: { id: true } }).then((rows) => new Set(rows.map((r) => r.id))),
    prisma.loanProductVersion.findMany({ select: { id: true } }).then((rows) => new Set(rows.map((r) => r.id))),
    prisma.portalAccount.findMany({ select: { id: true } }).then((rows) => new Set(rows.map((r) => r.id))),
  ]);

  const restoredApplicationIds = new Set<string>();
  let applicationsRestored = 0;
  for (const raw of payload.loanApplications) {
    const row = reviveDates(raw, LOAN_APPLICATION_DATE_FIELDS);
    row.branchId = newBranchId;
    row.encodedByUserId = null;
    row.reviewedByUserId = null;
    row.reviewStartedByUserId = null;
    row.preApprovedByUserId = null;
    // borrowerId/portalAccountId/assignedLoanProductVersionId: if set, these referenced rows are
    // themselves either legacy-sourced (survives the reset with the SAME id, since legacy-derived
    // rows aren't regenerated with new ids the way branches/users are) or native (out of scope, not
    // restored by this script - Borrower/LoanAccount/PortalAccount are deliberately excluded, see
    // this script's own header comment). Null out any reference that doesn't actually resolve
    // post-reset instead of letting the whole row's insert fail on a dangling FK.
    if (row.borrowerId && !existingBorrowerIds.has(row.borrowerId as string)) {
      console.warn(`  ! ${row.id} (${row.applicantName}): borrowerId ${row.borrowerId} hindi na umiiral, na-null out.`);
      row.borrowerId = null;
    }
    if (row.assignedLoanProductVersionId && !existingProductVersionIds.has(row.assignedLoanProductVersionId as string)) {
      console.warn(`  ! ${row.id} (${row.applicantName}): assignedLoanProductVersionId ${row.assignedLoanProductVersionId} hindi na umiiral, na-null out.`);
      row.assignedLoanProductVersionId = null;
    }
    if (row.portalAccountId && !existingPortalAccountIds.has(row.portalAccountId as string)) {
      console.warn(`  ! ${row.id} (${row.applicantName}): portalAccountId ${row.portalAccountId} hindi na umiiral, na-null out.`);
      row.portalAccountId = null;
    }
    try {
      await prisma.loanApplication.create({ data: row as never });
      restoredApplicationIds.add(row.id as string);
      applicationsRestored++;
    } catch (error) {
      console.warn(`  ! Nalaktawan ang loan application ${row.id} (${row.applicantName}) - ${(error as Error).message.split('\n')[0]}`);
    }
  }

  let attachmentsRestored = 0;
  let attachmentsSkipped = 0;
  for (const raw of payload.attachments) {
    const row = reviveDates(raw, ATTACHMENT_DATE_FIELDS);
    row.uploadedByUserId = null;
    if (row.ownerType !== 'LOAN_APPLICATION' || !restoredApplicationIds.has(row.ownerId as string)) {
      attachmentsSkipped++;
      continue;
    }
    try {
      await prisma.attachment.create({ data: row as never });
      attachmentsRestored++;
    } catch (error) {
      console.warn(`  ! Nalaktawan ang attachment ${row.id} (${row.fileName}) - ${(error as Error).message.split('\n')[0]}`);
      attachmentsSkipped++;
    }
  }

  console.log('');
  console.log(`Na-restore: ${applicationsRestored}/${payload.loanApplications.length} loan application(s), ${attachmentsRestored} attachment(s).`);
  if (attachmentsSkipped > 0) {
    console.log(`Nalaktawan: ${attachmentsSkipped} attachment(s) (BORROWER/LOAN_ACCOUNT-owned, o may application na hindi na-restore - see FEATURE scope note sa script na ito).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
