/* eslint-disable no-console */
/**
 * 2026-09-11 (user request, "8 AUGUST 2026" loan-releases folder): attaches Rodgie Pascual's
 * SML-REG_00387 documents (7 of 8 - "Selfie Photo.pdf" was too large for the Drive connector's
 * download tool, over its 10MB limit, and needs manual handling separately). Each file's content
 * was read and confirmed to match its label before staging. Same storage/DB pattern as
 * scratch-attach-september-releases.ts.
 *
 * Usage:
 *   npx tsx scripts/scratch-attach-pascual-00387.ts            # dry run
 *   npx tsx scripts/scratch-attach-pascual-00387.ts --apply    # writes
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const STAGING_DIR =
  'C:\\Users\\Admin\\AppData\\Local\\Temp\\claude\\E--ECLC-LMS-CLAUDE-CODE\\f7686b92-7651-4a22-a278-df01c3fcadd1\\scratchpad\\drive_attach_staging\\SML-REG_00387';
const LOAN_CODE = 'SML-REG_00387';

async function main(): Promise<void> {
  console.log(`${LOAN_CODE} attach — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);

  const loan = await prisma.loanAccount.findFirst({ where: { loanCode: LOAN_CODE }, select: { id: true } });
  if (!loan) {
    console.log('SKIPPED - could not resolve LoanAccount.');
    await prisma.$disconnect();
    return;
  }
  const ownerId = loan.id;

  const existing = await prisma.attachment.count({ where: { ownerType: 'LOAN_ACCOUNT', ownerId } });
  if (existing > 0) {
    console.log(`SKIPPED - already has ${existing} attachment(s), no longer zero.`);
    await prisma.$disconnect();
    return;
  }

  const files = fs.readdirSync(STAGING_DIR).filter((f) => fs.statSync(path.join(STAGING_DIR, f)).isFile());
  console.log(`${files.length} file(s) staged:`);
  for (const f of files) console.log(`    ${f}`);

  const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
  if (APPLY) {
    for (const fileName of files) {
      const filePath = path.join(STAGING_DIR, fileName);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName);
      const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName;
      const storageKey = path.posix.join('loan_account', ownerId, `${randomUUID()}${ext}`);
      await storage.save(storageKey, buffer);
      await prisma.attachment.create({
        data: { ownerType: 'LOAN_ACCOUNT', ownerId, fileName: nameWithoutExt, fileType: ext, storageKey, fileSize: buffer.length },
      });
    }
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - ${files.length} attachment(s) ${APPLY ? 'written' : 'would be written'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
