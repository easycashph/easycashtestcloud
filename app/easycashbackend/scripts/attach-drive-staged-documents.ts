/* eslint-disable no-console */
/**
 * 2026-08-28 (user request): attaches files staged locally (downloaded from a Google Drive client
 * folder by a helper agent, see the scratchpad `drive_attach_staging/<clientKey>/` directories) to
 * the matching Borrower or LoanAccount - three specific zero-attachment clients identified via a
 * one-off Drive-vs-database cross-check this session, not a general recurring backfill.
 *
 * `MANIFEST` below maps each staged directory to its target owner (LOAN_ACCOUNT when the client
 * already has a loan account, BORROWER otherwise - matches this session's own findings). Same
 * storage/DB pattern as `backfill-201files-loan-attachments.ts` (storageKey =
 * `<owner_type>/<ownerId>/<uuid><ext>`, fileName = original name without extension).
 *
 * Usage:
 *   npx tsx scripts/attach-drive-staged-documents.ts            # dry run - lists files, no writes
 *   npx tsx scripts/attach-drive-staged-documents.ts --apply    # writes files + DB rows
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const STAGING_ROOT = process.env.DRIVE_STAGING_DIR ?? 'C:\\Users\\EASYCASH\\AppData\\Local\\Temp\\claude\\C--ECLC-CLAUDE-CODE\\95617cc6-d5ee-4f6a-850d-fad57b5ee654\\scratchpad\\drive_attach_staging';

const MANIFEST: { dir: string; ownerType: 'LOAN_ACCOUNT' | 'BORROWER'; identifier: string }[] = [
  { dir: 'nelson_malinao', ownerType: 'LOAN_ACCOUNT', identifier: 'SML-REG_00385' },
  { dir: 'leonides_remolado', ownerType: 'BORROWER', identifier: 'Leonides Suminguit Remolado Jr' },
  { dir: 'aryll_malinao', ownerType: 'BORROWER', identifier: 'Aryll Gacu Malinao' },
];

async function resolveOwnerId(entry: (typeof MANIFEST)[number]): Promise<string | null> {
  if (entry.ownerType === 'LOAN_ACCOUNT') {
    const loan = await prisma.loanAccount.findFirst({ where: { loanCode: entry.identifier }, select: { id: true } });
    return loan?.id ?? null;
  }
  // BORROWER: identifier is "First Middle Last" as matched this session - resolve via first+last name.
  const parts = entry.identifier.trim().split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];
  const borrower = await prisma.borrower.findFirst({
    where: { firstName: { equals: first, mode: 'insensitive' }, lastName: { equals: last, mode: 'insensitive' } },
    select: { id: true },
  });
  return borrower?.id ?? null;
}

async function main(): Promise<void> {
  console.log(`Drive-staged document attach — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Staging root: ${STAGING_ROOT}`);

  const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
  let totalAttached = 0;

  for (const entry of MANIFEST) {
    const dirPath = path.join(STAGING_ROOT, entry.dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`\n[${entry.identifier}] SKIPPED - staging dir not found: ${dirPath}`);
      continue;
    }
    const files = fs.readdirSync(dirPath).filter((f) => fs.statSync(path.join(dirPath, f)).isFile());
    if (files.length === 0) {
      console.log(`\n[${entry.identifier}] SKIPPED - no files staged.`);
      continue;
    }

    const ownerId = await resolveOwnerId(entry);
    if (!ownerId) {
      console.log(`\n[${entry.identifier}] SKIPPED - could not resolve ${entry.ownerType} in the database.`);
      continue;
    }

    // Re-verify zero-attachment invariant right before writing - guards against this having
    // changed between the survey and this run (e.g. someone uploaded manually in the meantime).
    const existing = await prisma.attachment.count({ where: { ownerType: entry.ownerType, ownerId } });
    if (existing > 0) {
      console.log(`\n[${entry.identifier}] SKIPPED - already has ${existing} attachment(s), no longer zero.`);
      continue;
    }

    console.log(`\n[${entry.identifier}] ${entry.ownerType} ${ownerId} - ${files.length} file(s) staged:`);
    for (const f of files) console.log(`    ${f}`);

    if (!APPLY) continue;

    for (const fileName of files) {
      const filePath = path.join(dirPath, fileName);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName);
      const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName;
      const storageKey = path.posix.join(entry.ownerType.toLowerCase(), ownerId, `${randomUUID()}${ext}`);
      await storage.save(storageKey, buffer);
      await prisma.attachment.create({
        data: {
          ownerType: entry.ownerType,
          ownerId,
          fileName: nameWithoutExt,
          fileType: ext,
          fileSize: buffer.length,
          storageKey,
        },
      });
      totalAttached++;
    }
    console.log(`  -> attached ${files.length} file(s).`);
  }

  console.log(`\n${APPLY ? 'Done' : 'Dry run only - no writes made'}. ${APPLY ? `${totalAttached} file(s) attached.` : 'Re-run with --apply to write.'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
