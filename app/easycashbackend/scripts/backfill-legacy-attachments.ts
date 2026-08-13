/* eslint-disable no-console */
/**
 * Backfill real file bytes for the 21,104 `Attachment` rows migrated as metadata-only placeholders
 * by scripts/migrate-legacy-data.ts's `migrateAttachments()` (ADR-006: "migrate metadata now,
 * backfill storageKey in a future storage-migration pass" — this is that pass).
 *
 * Source: the legacy SDevTech SFTP server, `/backups/loan_account/<LoanAccount.legacyId>/` — one
 * folder per loan account, containing that loan's attachment files directly (confirmed 2026-07-31
 * against a live SFTP browse + the legacy `attachments` collection's own `path` field, whose
 * `attachments/loan_account/<uid>/<fileName>` suffix matches this SFTP layout 1:1 apart from the
 * root segment). Only LOAN_ACCOUNT-owned attachments are handled here — BORROWER-owned attachments
 * (client-level files) use a different, not-yet-confirmed SFTP path and are explicitly out of
 * scope until that's verified.
 *
 * Never touches the legacy SFTP source (read-only) - CLAUDE.md "never modify legacy data during
 * migration". Idempotent: skips any Attachment row whose storageKey is no longer a
 * "legacy-unmigrated:" placeholder, so a re-run only fills in what's still missing.
 *
 * Usage:
 *   npx tsx scripts/backfill-legacy-attachments.ts                    # dry run, all eligible loans
 *   npx tsx scripts/backfill-legacy-attachments.ts --limit=5          # dry run, first 5 loans only
 *   npx tsx scripts/backfill-legacy-attachments.ts --limit=5 --apply  # actually download + write
 */
import 'dotenv/config';
import * as path from 'node:path';
import SftpClient from 'ssh2-sftp-client';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LOAN_LIMIT = limitArg ? Number(limitArg.split('=')[1]) : undefined;

const PLACEHOLDER_PREFIX = 'legacy-unmigrated:';
const SFTP_ROOT = '/backups/loan_account';

interface Reconciliation {
  loansConsidered: number;
  attachmentsConsidered: number;
  downloaded: number;
  skipped: number;
  skipReasons: Map<string, number>;
}

function newReconciliation(): Reconciliation {
  return { loansConsidered: 0, attachmentsConsidered: 0, downloaded: 0, skipped: 0, skipReasons: new Map() };
}

function recordSkip(rec: Reconciliation, reason: string): void {
  rec.skipped++;
  rec.skipReasons.set(reason, (rec.skipReasons.get(reason) ?? 0) + 1);
}

function printReconciliation(rec: Reconciliation): void {
  console.log('\n=== Reconciliation ===');
  console.log(`loans considered: ${rec.loansConsidered}`);
  console.log(`attachments considered: ${rec.attachmentsConsidered}`);
  console.log(`downloaded: ${rec.downloaded}`);
  console.log(`skipped: ${rec.skipped}`);
  for (const [reason, count] of rec.skipReasons) {
    console.log(`    skipped (${reason}): ${count}`);
  }
}

async function main(): Promise<void> {
  console.log(`Legacy attachment backfill — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);
  if (LOAN_LIMIT) console.log(`Limited to the first ${LOAN_LIMIT} loan(s) with pending attachments.`);

  const requiredEnv = ['SDEVTECH_SFTP_HOST', 'SDEVTECH_SFTP_PORT', 'SDEVTECH_SFTP_USERNAME', 'SDEVTECH_SFTP_PASSWORD'] as const;
  for (const key of requiredEnv) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  }

  // Distinct loan accounts that still have at least one placeholder attachment - the unit we cap
  // with --limit, so a small test run exercises a handful of whole loans rather than a scattershot
  // slice of one giant loan's attachments.
  const pendingLoanIds = await prisma.attachment.findMany({
    where: { ownerType: 'LOAN_ACCOUNT', storageKey: { startsWith: PLACEHOLDER_PREFIX } },
    select: { ownerId: true },
    distinct: ['ownerId'],
    orderBy: { ownerId: 'asc' },
    take: LOAN_LIMIT,
  });

  const rec = newReconciliation();
  const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
  const sftp = new SftpClient();
  await sftp.connect({
    host: process.env.SDEVTECH_SFTP_HOST,
    port: Number(process.env.SDEVTECH_SFTP_PORT),
    username: process.env.SDEVTECH_SFTP_USERNAME,
    password: process.env.SDEVTECH_SFTP_PASSWORD,
  });

  try {
    for (const { ownerId } of pendingLoanIds) {
      rec.loansConsidered++;

      const loanAccount = await prisma.loanAccount.findUnique({ where: { id: ownerId }, select: { legacyId: true, loanCode: true } });
      if (!loanAccount?.legacyId) {
        const attachments = await prisma.attachment.findMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId, storageKey: { startsWith: PLACEHOLDER_PREFIX } } });
        rec.attachmentsConsidered += attachments.length;
        for (let i = 0; i < attachments.length; i++) recordSkip(rec, 'loan account has no legacyId');
        continue;
      }

      const remoteDir = `${SFTP_ROOT}/${loanAccount.legacyId}`;
      let remoteFiles: SftpClient.FileInfo[];
      try {
        remoteFiles = await sftp.list(remoteDir);
      } catch (err) {
        console.log(`  [${loanAccount.loanCode}] no remote folder at ${remoteDir} (${(err as Error).message})`);
        const attachments = await prisma.attachment.findMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId, storageKey: { startsWith: PLACEHOLDER_PREFIX } } });
        rec.attachmentsConsidered += attachments.length;
        for (let i = 0; i < attachments.length; i++) recordSkip(rec, 'no remote folder for this loan');
        continue;
      }

      const attachments = await prisma.attachment.findMany({
        where: { ownerType: 'LOAN_ACCOUNT', ownerId, storageKey: { startsWith: PLACEHOLDER_PREFIX } },
      });
      rec.attachmentsConsidered += attachments.length;

      for (const attachment of attachments) {
        const expectedName = `${attachment.fileName}${attachment.fileType}`;
        // 2026-08-13 (bug fix, confirmed via a live SFTP listing): the legacy SFTP server returns
        // filenames as UTF-8 bytes that have been mis-decoded as Latin-1 (mojibake) - e.g. "Reaño"
        // (correct, as stored in our migrated Attachment rows) comes back as "ReaÃ±o". Re-decoding
        // each remote name (Latin-1 bytes -> UTF-8) recovers the original for comparison; this is a
        // no-op for any name with no non-ASCII bytes, so plain-ASCII filenames are unaffected.
        // `match.name` (the RAW, still-mojibake name) is what's actually used for the download
        // below, since that's the literal name the server expects on its own filesystem.
        const match = remoteFiles.find((f) => f.name === expectedName || Buffer.from(f.name, 'latin1').toString('utf8') === expectedName);
        if (!match) {
          console.log(`  [${loanAccount.loanCode}] MISSING on SFTP: "${expectedName}"`);
          recordSkip(rec, 'file not found in remote folder');
          continue;
        }

        console.log(`  [${loanAccount.loanCode}] found "${expectedName}" (${match.size} bytes)`);
        if (!APPLY) {
          rec.downloaded++;
          continue;
        }

        const buffer = (await sftp.get(`${remoteDir}/${match.name}`)) as Buffer;
        const extension = path.extname(attachment.fileName + attachment.fileType).slice(0, 10) || attachment.fileType;
        const storageKey = path.posix.join('loan_account', attachment.ownerId, `${attachment.id}${extension}`);
        await storage.save(storageKey, buffer);
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: { storageKey, fileSize: buffer.length },
        });
        rec.downloaded++;
      }
    }
  } finally {
    await sftp.end();
  }

  printReconciliation(rec);
  if (!APPLY) console.log('\nDry run only — re-run with --apply to actually download files and update the database.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
