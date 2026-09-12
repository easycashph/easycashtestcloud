/* eslint-disable no-console */
/**
 * 2026-09-12: attaches the one remaining document from scratch-attach-pascual-00387.ts's original
 * 8-file set for SML-REG_00387 (Rodgie Pascual) - "Selfie Photo.pdf" (10.6MB) was too large for the
 * Google Drive MCP connector's download tool (10MB ceiling) and had to be downloaded manually by
 * the user and placed in the staging directory. Content verified (selfie of Rodgie Gatchalian
 * Pascual holding his SSS ID) before attaching.
 *
 * Usage:
 *   npx tsx scripts/scratch-attach-pascual-selfie-00387.ts            # dry run
 *   npx tsx scripts/scratch-attach-pascual-selfie-00387.ts --apply    # writes
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const FILE_PATH =
  'C:\\Users\\Admin\\AppData\\Local\\Temp\\claude\\E--ECLC-LMS-CLAUDE-CODE\\f7686b92-7651-4a22-a278-df01c3fcadd1\\scratchpad\\drive_attach_staging\\SML-REG_00387\\Pascual, R - Selfie Photo.pdf';
const LOAN_CODE = 'SML-REG_00387';
const FILE_NAME = 'Selfie Photo';

async function main(): Promise<void> {
  console.log(`${LOAN_CODE} selfie attach — mode: ${APPLY ? 'APPLY (writing file + DB)' : 'DRY RUN (no writes)'}`);

  const loan = await prisma.loanAccount.findFirst({ where: { loanCode: LOAN_CODE }, select: { id: true } });
  if (!loan) {
    console.log('SKIPPED - could not resolve LoanAccount.');
    await prisma.$disconnect();
    return;
  }
  const ownerId = loan.id;

  const already = await prisma.attachment.findFirst({ where: { ownerType: 'LOAN_ACCOUNT', ownerId, fileName: FILE_NAME } });
  if (already) {
    console.log(`SKIPPED - "${FILE_NAME}" attachment already exists (id ${already.id}).`);
    await prisma.$disconnect();
    return;
  }

  if (!fs.existsSync(FILE_PATH)) {
    console.log(`SKIPPED - file not found at ${FILE_PATH}`);
    await prisma.$disconnect();
    return;
  }

  const buffer = fs.readFileSync(FILE_PATH);
  console.log(`  ${path.basename(FILE_PATH)} (${buffer.length} bytes)  ->  fileName: "${FILE_NAME}"`);

  if (APPLY) {
    const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
    const ext = '.pdf';
    const storageKey = path.posix.join('loan_account', ownerId, `${randomUUID()}${ext}`);
    await storage.save(storageKey, buffer);
    await prisma.attachment.create({
      data: { ownerType: 'LOAN_ACCOUNT', ownerId, fileName: FILE_NAME, fileType: ext, storageKey, fileSize: buffer.length },
    });
  }

  console.log(`\n${APPLY ? 'Apply complete' : 'Dry run complete'} - 1 attachment ${APPLY ? 'written' : 'would be written'}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
