/* eslint-disable no-console */
/**
 * 2026-09-11 (user request): attaches files staged locally (downloaded from the "9 SEPTEMBER 2026"
 * Google Drive loan-releases folder) to their matching LoanAccount. Same storage/DB pattern as
 * attach-drive-staged-documents.ts (storageKey = `<owner_type>/<ownerId>/<uuid><ext>`, fileName =
 * original name without extension).
 *
 * Usage:
 *   npx tsx scripts/scratch-attach-september-releases.ts            # dry run - lists files, no writes
 *   npx tsx scripts/scratch-attach-september-releases.ts --apply    # writes files + DB rows
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const STAGING_ROOT =
  'C:\\Users\\Admin\\AppData\\Local\\Temp\\claude\\E--ECLC-LMS-CLAUDE-CODE\\f7686b92-7651-4a22-a278-df01c3fcadd1\\scratchpad\\drive_attach_staging';

const MANIFEST: { dir: string; loanCode: string }[] = [
  { dir: 'SML-REG_00389', loanCode: 'SML-REG_00389' },
  { dir: 'SML-REG_00390', loanCode: 'SML-REG_00390' },
  { dir: 'SML-REG_00391', loanCode: 'SML-REG_00391' },
];

async function main(): Promise<void> {
  console.log(`September 2026 loan-release document attach — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Staging root: ${STAGING_ROOT}`);

  const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
  let totalAttached = 0;

  for (const entry of MANIFEST) {
    const dirPath = path.join(STAGING_ROOT, entry.dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`\n[${entry.loanCode}] SKIPPED - staging dir not found: ${dirPath}`);
      continue;
    }
    const files = fs.readdirSync(dirPath).filter((f) => fs.statSync(path.join(dirPath, f)).isFile());
    if (files.length === 0) {
      console.log(`\n[${entry.loanCode}] SKIPPED - no files staged.`);
      continue;
    }

    const loan = await prisma.loanAccount.findFirst({ where: { loanCode: entry.loanCode }, select: { id: true } });
    if (!loan) {
      console.log(`\n[${entry.loanCode}] SKIPPED - could not resolve LoanAccount in the database.`);
      continue;
    }
    const ownerId = loan.id;

    // Re-verify zero-attachment invariant right before writing - guards against this having
    // changed between the survey and this run.
    const existing = await prisma.attachment.count({ where: { ownerType: 'LOAN_ACCOUNT', ownerId } });
    if (existing > 0) {
      console.log(`\n[${entry.loanCode}] SKIPPED - already has ${existing} attachment(s), no longer zero.`);
      continue;
    }

    console.log(`\n[${entry.loanCode}] LOAN_ACCOUNT ${ownerId} - ${files.length} file(s) staged:`);
    for (const f of files) console.log(`    ${f}`);

    if (!APPLY) continue;

    for (const fileName of files) {
      const filePath = path.join(dirPath, fileName);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName);
      const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName;
      const storageKey = path.posix.join('loan_account', ownerId, `${randomUUID()}${ext}`);
      await storage.save(storageKey, buffer);
      await prisma.attachment.create({
        data: {
          ownerType: 'LOAN_ACCOUNT',
          ownerId,
          fileName: nameWithoutExt,
          fileType: ext,
          storageKey,
          fileSize: buffer.length,
        },
      });
      totalAttached += 1;
    }
    console.log(`    -> attached ${files.length} file(s).`);
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${totalAttached} attachment(s) ${APPLY ? 'written' : 'would be written'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
