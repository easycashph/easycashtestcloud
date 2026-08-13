/* eslint-disable no-console */
/**
 * 2026-08-13 (user request) - full local-storage sync for every LOAN_ACCOUNT attachment, straight
 * from the legacy SDevTech SFTP source, regardless of whether its DB `storageKey` is still a
 * "legacy-unmigrated:" placeholder (backfill-legacy-attachments.ts's job) or already a real key
 * (migrated by a PRIOR run of that same script on a different machine - e.g. MIS Nomer's laptop).
 * Solves the "won't fit on a flash drive" problem raised for physically copying that machine's
 * `storage/` folder here: since the real source of truth is the legacy SFTP server itself, this
 * machine can independently re-populate its own `storage/` folder straight from source instead,
 * with no dependency on the other machine's local disk at all.
 *
 * For an attachment whose DB storageKey is ALREADY a real key (previously migrated elsewhere),
 * this only WRITES the file locally at that exact same key - it never touches the database, so
 * there is no risk of re-migrating/re-keying an already-correct record.
 *
 * Skips any attachment whose file already exists locally (safe to re-run after an interruption -
 * only fills in what's still missing on THIS machine's disk).
 *
 * Same "MISSING on SFTP" mojibake fix as backfill-legacy-attachments.ts (2026-08-13) - the legacy
 * SFTP server returns filenames as UTF-8 bytes mis-decoded as Latin-1.
 *
 * Usage:
 *   npx tsx scripts/sync-all-loan-account-attachments-from-sftp.ts                    # dry run
 *   npx tsx scripts/sync-all-loan-account-attachments-from-sftp.ts --limit=5          # dry run, first 5 loans
 *   npx tsx scripts/sync-all-loan-account-attachments-from-sftp.ts --limit=5 --apply  # actually download + write
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import SftpClient from 'ssh2-sftp-client';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LOAN_LIMIT = limitArg ? Number(limitArg.split('=')[1]) : undefined;

const SFTP_ROOT = '/backups/loan_account';

interface Reconciliation {
  loansConsidered: number;
  attachmentsConsidered: number;
  alreadyOnDisk: number;
  downloaded: number;
  skipped: number;
  skipReasons: Map<string, number>;
}

function newReconciliation(): Reconciliation {
  return { loansConsidered: 0, attachmentsConsidered: 0, alreadyOnDisk: 0, downloaded: 0, skipped: 0, skipReasons: new Map() };
}

function recordSkip(rec: Reconciliation, reason: string): void {
  rec.skipped++;
  rec.skipReasons.set(reason, (rec.skipReasons.get(reason) ?? 0) + 1);
}

function printReconciliation(rec: Reconciliation): void {
  console.log('\n=== Reconciliation ===');
  console.log(`loans considered: ${rec.loansConsidered}`);
  console.log(`attachments considered: ${rec.attachmentsConsidered}`);
  console.log(`already on disk (skipped): ${rec.alreadyOnDisk}`);
  console.log(`downloaded: ${rec.downloaded}`);
  console.log(`skipped: ${rec.skipped}`);
  for (const [reason, count] of rec.skipReasons) {
    console.log(`    skipped (${reason}): ${count}`);
  }
}

async function main(): Promise<void> {
  console.log(`Full attachment storage sync — mode: ${APPLY ? 'APPLY (writing files)' : 'DRY RUN (no writes)'}`);
  if (LOAN_LIMIT) console.log(`Limited to the first ${LOAN_LIMIT} loan(s).`);

  const requiredEnv = ['SDEVTECH_SFTP_HOST', 'SDEVTECH_SFTP_PORT', 'SDEVTECH_SFTP_USERNAME', 'SDEVTECH_SFTP_PASSWORD'] as const;
  for (const key of requiredEnv) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  }

  const storage = new LocalFileStorage(resolve(env.STORAGE_LOCAL_PATH));
  const storageRoot = resolve(env.STORAGE_LOCAL_PATH);

  const loanIds = await prisma.attachment.findMany({
    where: { ownerType: 'LOAN_ACCOUNT' },
    select: { ownerId: true },
    distinct: ['ownerId'],
    ...(LOAN_LIMIT ? { take: LOAN_LIMIT } : {}),
  });

  const rec = newReconciliation();
  const sftp = new SftpClient();
  await sftp.connect({
    host: process.env.SDEVTECH_SFTP_HOST,
    port: Number(process.env.SDEVTECH_SFTP_PORT),
    username: process.env.SDEVTECH_SFTP_USERNAME,
    password: process.env.SDEVTECH_SFTP_PASSWORD,
  });

  try {
    for (const { ownerId } of loanIds) {
      rec.loansConsidered++;

      const loanAccount = await prisma.loanAccount.findUnique({ where: { id: ownerId }, select: { legacyId: true, loanCode: true } });
      const attachments = await prisma.attachment.findMany({ where: { ownerType: 'LOAN_ACCOUNT', ownerId } });

      if (!loanAccount?.legacyId) {
        rec.attachmentsConsidered += attachments.length;
        for (let i = 0; i < attachments.length; i++) recordSkip(rec, 'loan account has no legacyId');
        continue;
      }

      const remoteDir = `${SFTP_ROOT}/${loanAccount.legacyId}`;
      let remoteFiles: SftpClient.FileInfo[] | undefined;

      for (const attachment of attachments) {
        rec.attachmentsConsidered++;

        // Reuse the existing real storageKey if this attachment was already migrated elsewhere;
        // otherwise compute the same key backfill-legacy-attachments.ts would assign it.
        const isPlaceholder = attachment.storageKey.startsWith('legacy-unmigrated:');
        const extension = attachment.fileType || '';
        const targetKey = isPlaceholder ? join('loan_account', attachment.ownerId, `${attachment.id}${extension}`).replace(/\\/g, '/') : attachment.storageKey;

        if (existsSync(join(storageRoot, targetKey))) {
          rec.alreadyOnDisk++;
          continue;
        }

        if (remoteFiles === undefined) {
          try {
            remoteFiles = await sftp.list(remoteDir);
          } catch (err) {
            console.log(`  [${loanAccount.loanCode}] no remote folder at ${remoteDir} (${(err as Error).message})`);
            remoteFiles = [];
          }
        }

        const expectedName = `${attachment.fileName}${attachment.fileType}`;
        // 2026-08-13: legacy SFTP server mojibake fix - see backfill-legacy-attachments.ts's
        // matching doc comment for the full explanation.
        const match = remoteFiles.find((f) => f.name === expectedName || Buffer.from(f.name, 'latin1').toString('utf8') === expectedName);
        if (!match) {
          console.log(`  [${loanAccount.loanCode}] MISSING on SFTP: "${expectedName}"`);
          recordSkip(rec, 'file not found in remote folder');
          continue;
        }

        console.log(`  [${loanAccount.loanCode}] ${isPlaceholder ? 'found (new)' : 'found (re-sync)'} "${expectedName}" (${match.size} bytes)`);
        if (!APPLY) {
          rec.downloaded++;
          continue;
        }

        const buffer = (await sftp.get(`${remoteDir}/${match.name}`)) as Buffer;
        await storage.save(targetKey, buffer);
        if (isPlaceholder) {
          await prisma.attachment.update({ where: { id: attachment.id }, data: { storageKey: targetKey, fileSize: buffer.length } });
        }
        rec.downloaded++;
      }
    }
  } finally {
    await sftp.end();
  }

  printReconciliation(rec);
  if (!APPLY) console.log('\nDry run only — re-run with --apply to actually download files.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
