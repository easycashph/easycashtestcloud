/* eslint-disable no-console */
/**
 * One-time import (2026-09-15, user request): Ricky R. Reforma [20100283] was one of the
 * "no local match found" entries in the 2026-08-13 missing-attachments scan (the automated matcher
 * only checks a normalized borrower-name key against folder names, and this borrower's local
 * folder is nested a level deeper than the scanner's depth covers) - user located the real folder
 * manually and gave it directly.
 *
 * Two physical loan cycles exist on disk (original + a "(2ND)" renewal subfolder) but only ONE
 * LoanAccount exists for this borrower in the LMS (20100283, ACTIVE_IN_ARREARS) - per user
 * decision, both cycles' files are attached to that one account rather than guessing which cycle
 * it corresponds to. Renamed on import (scanner-generated names like "CCI09032010_00000.jpg" carry
 * no information) to `REFORMA_RICKY_20100283_{1ST|2ND}_##.jpg`, sequenced by original file order.
 *
 * Idempotent: legacyId = `local-archive:<absolute path>` (same convention as
 * import-attachments-from-local-archive.ts), upserted-by-uniqueness via a pre-check.
 *
 * Usage:
 *   npx tsx scripts/scratch-import-reforma-ricky-attachments.ts            # dry run
 *   npx tsx scripts/scratch-import-reforma-ricky-attachments.ts --apply    # write files + DB rows
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const LOAN_ACCOUNT_ID = 'ce953676-a610-4a7a-b798-e01113eaf2d5'; // loanCode 20100283, Ricky R. Reforma
const LEGACY_ID_PREFIX = 'local-archive:';

const FOLDERS: { path: string; cycleLabel: string }[] = [
  { path: String.raw`E:\201_Files\2011\08 AUGUST 2011\A-0244-SL REFORMA, RICKY`, cycleLabel: '1ST' },
  { path: String.raw`E:\201_Files\2011\08 AUGUST 2011\A-0244-SL REFORMA, RICKY\A-0244-SL (2ND) REFORMA, RICKY`, cycleLabel: '2ND' },
];

async function main(): Promise<void> {
  console.log(`Import Reforma, Ricky attachments — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);

  const storage = new LocalFileStorage(resolve(env.STORAGE_LOCAL_PATH));
  let imported = 0;
  let alreadyImported = 0;

  for (const folder of FOLDERS) {
    const entries = await readdir(folder.path, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));

    let sequence = 0;
    for (const entry of files) {
      sequence++;
      const absolutePath = join(folder.path, entry.name);
      const ext = extname(entry.name).toLowerCase();
      const newFileName = `REFORMA_RICKY_20100283_${folder.cycleLabel}_${String(sequence).padStart(2, '0')}`;
      const legacyId = `${LEGACY_ID_PREFIX}${absolutePath}`;

      const existing = await prisma.attachment.findUnique({ where: { legacyId } });
      if (existing) {
        alreadyImported++;
        continue;
      }

      console.log(`  [${folder.cycleLabel}] "${entry.name}" -> "${newFileName}${ext}"`);
      if (!APPLY) {
        imported++;
        continue;
      }

      const buffer = await readFile(absolutePath);
      const attachmentId = crypto.randomUUID();
      const storageKey = `loan_account/${LOAN_ACCOUNT_ID}/${attachmentId}${ext}`;
      await storage.save(storageKey, buffer);
      await prisma.attachment.create({
        data: {
          id: attachmentId,
          ownerType: 'LOAN_ACCOUNT',
          ownerId: LOAN_ACCOUNT_ID,
          fileName: newFileName,
          fileType: ext,
          fileSize: buffer.length,
          storageKey,
          legacyId,
        },
      });
      imported++;
    }
  }

  console.log(`\nDone. imported: ${imported}, already imported (idempotent skip): ${alreadyImported}`);
  if (!APPLY) console.log('Dry run only — re-run with --apply to actually write files and DB rows.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
