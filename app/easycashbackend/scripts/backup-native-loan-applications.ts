/**
 * 2026-08-19 (user request): `LoanApplication` has NO `legacyId` field at all - it's never
 * MongoDB-sourced, always created locally in the LMS (walk-in encode or Portal self-service). A
 * full `prisma migrate reset --force` (see "Run Full Legacy Migration (Office Server PC).bat")
 * wipes it along with everything else, and nothing re-creates it afterward - unlike
 * Borrower/LoanAccount/LoanTransaction/Attachment rows that DO carry a `legacyId` and get rebuilt
 * from the MongoDB backup, a LoanApplication (and any native, non-legacy `Attachment` uploaded
 * against one) is gone for good otherwise.
 *
 * Scope, deliberately narrow: dumps every `LoanApplication` row (all of them, since none are
 * legacy-sourced) plus every `Attachment` row with `legacyId IS NULL` (native uploads only -
 * legacy-migrated attachments already survive the reset via their own re-migration). Does NOT
 * attempt to preserve native (non-legacy) `Borrower`/`LoanAccount` rows or anything under them
 * (transactions, repayment schedules, addresses) - those sit deep in the real financial ledger and
 * restoring them blind, across a full reset where every id (branches, users, whatever a borrowerId
 * might point at) gets regenerated, risks silently corrupting real balances. That's a materially
 * harder, higher-stakes problem than "don't lose an applicant's uploaded ID photo" and is
 * explicitly out of scope here.
 *
 * Run this BEFORE the reset. Pairs with restore-native-loan-applications.ts, run AFTER the fresh
 * migration completes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

function jsonSafe(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toFixed' in value && typeof (value as { toString: () => string }).toString === 'function') {
    // Prisma Decimal - has no simple `instanceof` check available here without importing the
    // runtime class; duck-typing on toFixed (Decimal-specific, Date has no toFixed) is reliable.
    return (value as { toString: () => string }).toString();
  }
  return value;
}

async function main() {
  const loanApplications = await prisma.loanApplication.findMany({ include: { borrower: { select: { legacyId: true } } } });
  const attachments = await prisma.attachment.findMany({ where: { legacyId: null } });

  if (loanApplications.length === 0 && attachments.length === 0) {
    console.log('Walang native loan application o attachment na nakita - walang kailangang i-backup.');
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(BACKUP_DIR, `native-loan-applications-${timestamp}.json`);

  // 2026-08-20 (bug fix, session log §35): `borrowerId` used to be left as a raw id, on the wrong
  // assumption that a legacy-sourced Borrower's id survives a reset unchanged - it doesn't (see
  // restore-native-portal-accounts.ts's own doc comment for the full finding). Denormalized to the
  // borrower's own `legacyId` here instead, same fix already applied there.
  const loanApplicationsWithLegacyBorrowerId = loanApplications.map((la) => {
    const { borrower, ...rest } = la;
    return { ...rest, borrowerLegacyId: borrower?.legacyId ?? null };
  });

  const payload = {
    createdAt: new Date().toISOString(),
    loanApplications: JSON.parse(JSON.stringify(loanApplicationsWithLegacyBorrowerId, (_key, v) => jsonSafe(v))),
    attachments: JSON.parse(JSON.stringify(attachments, (_key, v) => jsonSafe(v))),
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Na-backup: ${loanApplications.length} loan application(s), ${attachments.length} native attachment(s).`);
  console.log(`Saved to: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
