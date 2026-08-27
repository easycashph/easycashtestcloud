/* eslint-disable no-console */
/**
 * 2026-08-27 (user request): recovers real attachment FILES (not just metadata) for loan accounts
 * that currently have ZERO Attachment rows in the LMS, by searching the manually-organized staff
 * backup at `legacy/Mambu/Mambu Attachement/2023/*.zip` and `October 2023.rar` - monthly archives
 * where each loan's documents live in their own folder, named `<LoanCode>-<Client Name> <month>`
 * (or `<Client Name> <LoanCode>`, order varies by month). Distinct from and complementary to:
 *   - `backfill-legacy-attachments.ts` (fills in file bytes for placeholder Attachment rows already
 *     migrated from SDevTech's own `attachments` Mongo collection, via the SDevTech SFTP server).
 *   - `backfill-mambu-customfield-addresses.ts` (same source folder tree's sibling investigation,
 *     for borrower addresses instead of loan attachments).
 * This script covers loans that never had ANY Attachment row at all - SDevTech's own export never
 * had them, but a human happened to keep the original uploaded files in this backup.
 *
 * Matching rule (deliberately conservative to avoid false positives - short numeric legacy loan
 * codes like "20" or "103" collide with unrelated substrings like dates or file sizes): a loan
 * code is only considered if it matches a known alphabetic-prefix pattern (BL-, SL-, SML-, PFL-,
 * OTH-, SP-, etc. - see LOAN_CODE_PATTERN), and a file is attributed to that loan only if the code
 * appears in the file's IMMEDIATE parent folder name specifically (not any ancestor) - this
 * correctly handles the batch/co-borrower folders that nest a different loan's own subfolder
 * inside a parent loan's folder (e.g. `BL-REG_B1X4F.../SML-Co-Borrower_A5H3L.../file.pdf` attributes
 * `file.pdf` to `SML-Co-Borrower_A5H3L`, not `BL-REG_B1X4F`).
 *
 * Idempotent by construction: only ever considers a loan account with zero existing Attachment
 * rows (same rule as `backfill-mambu-customfield-addresses.ts`) - once this script gives a loan its
 * first attachment, a re-run naturally skips it.
 *
 * Requires 7-Zip (`7z.exe`) on PATH or at the default Windows install location - handles both .zip
 * and .rar archives uniformly via `7z x -so` (extract-to-stdout), unlike the plain `unzip` CLI which
 * can't read .rar at all.
 *
 * Usage:
 *   npx tsx scripts/backfill-mambu-loan-attachments.ts            # dry run — reports only
 *   npx tsx scripts/backfill-mambu-loan-attachments.ts --apply    # writes files + DB rows
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const ARCHIVE_DIR = path.resolve(__dirname, '../../../legacy/Mambu/Mambu Attachement/2023');

const SEVEN_ZIP_CANDIDATES = ['7z', 'C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe'];

function resolveSevenZip(): string {
  for (const candidate of SEVEN_ZIP_CANDIDATES) {
    try {
      execFileSync(candidate, ['-h'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error('7-Zip (7z.exe) not found - install it or add it to PATH.');
}

// Known loan-code prefixes seen in this codebase's `loanCode` values - see migrate-legacy-data.ts's
// own product-code mapping. Deliberately excludes plain numeric legacy codes (e.g. "20100169"),
// which are too short/ambiguous to safely substring-match against archive paths.
const LOAN_CODE_PATTERN = /^(BL|SL|SML|PFL|OTH|SP)-[A-Za-z-]+_[A-Za-z0-9]+$/;

interface ArchiveEntry {
  archive: string;
  internalPath: string; // as 7z reports it - '/' for zip, '\' for rar
  size: number;
  modified: Date | null;
}

function parseSevenZipListing(sevenZip: string, archivePath: string): ArchiveEntry[] {
  const output = execFileSync(sevenZip, ['l', '-slt', archivePath], { maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
  const blocks = output.split(/\r?\n\r?\n/);
  const entries: ArchiveEntry[] = [];
  for (const block of blocks) {
    const pathMatch = block.match(/^Path = (.+)$/m);
    const folderMatch = block.match(/^Folder = (.+)$/m);
    const sizeMatch = block.match(/^Size = (\d+)$/m);
    const modifiedMatch = block.match(/^Modified = (.+)$/m);
    if (!pathMatch || folderMatch?.[1] === '+') continue;
    entries.push({
      archive: archivePath,
      internalPath: pathMatch[1]!,
      size: sizeMatch ? Number(sizeMatch[1]) : 0,
      modified: modifiedMatch ? new Date(modifiedMatch[1]!) : null,
    });
  }
  // First block is always the archive itself (Path = archivePath) - drop it.
  return entries.filter((e) => e.internalPath !== archivePath && path.basename(e.internalPath) !== path.basename(archivePath));
}

function immediateParentFolderName(internalPath: string): string {
  const normalized = internalPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments.length >= 2 ? segments[segments.length - 2]! : '';
}

function loanCodeBoundaryMatch(folderName: string, loanCode: string): boolean {
  const escaped = loanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}($|[^A-Za-z0-9_])`).test(folderName);
}

async function main(): Promise<void> {
  console.log(`Mambu loan-attachment recovery — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Archive dir: ${ARCHIVE_DIR}`);
  if (!fs.existsSync(ARCHIVE_DIR)) throw new Error(`"${ARCHIVE_DIR}" not found.`);

  const sevenZip = resolveSevenZip();

  const archiveFiles = fs
    .readdirSync(ARCHIVE_DIR)
    .filter((f) => /\.(zip|rar)$/i.test(f))
    .map((f) => path.join(ARCHIVE_DIR, f));
  console.log(`Found ${archiveFiles.length} archive(s).`);

  console.log('Listing archive contents (this may take a moment for large archives)...');
  const allEntries: ArchiveEntry[] = [];
  for (const archive of archiveFiles) {
    const entries = parseSevenZipListing(sevenZip, archive);
    console.log(`  ${path.basename(archive)}: ${entries.length} file(s)`);
    allEntries.push(...entries);
  }
  console.log(`Total files across all archives: ${allEntries.length}`);

  console.log('\nFinding loan accounts in the live database with zero attachments...');
  const targetLoans: { id: string; loanCode: string }[] = await prisma.$queryRawUnsafe(`
    SELECT la.id, la."loanCode"
    FROM loan_accounts la
    WHERE NOT EXISTS (
      SELECT 1 FROM attachments att WHERE att."ownerType"='LOAN_ACCOUNT' AND att."ownerId"=la.id
    )
  `);
  const eligibleLoans = targetLoans.filter((l) => LOAN_CODE_PATTERN.test(l.loanCode));
  console.log(`  ${targetLoans.length} loans have zero attachments; ${eligibleLoans.length} have a recoverable-shaped loan code.`);

  const matchesByLoan = new Map<string, ArchiveEntry[]>();
  for (const loan of eligibleLoans) {
    const matches = allEntries.filter((e) => loanCodeBoundaryMatch(immediateParentFolderName(e.internalPath), loan.loanCode));
    if (matches.length > 0) matchesByLoan.set(loan.loanCode, matches);
  }

  console.log(`\n=== Reconciliation ===`);
  console.log({
    eligibleLoans: eligibleLoans.length,
    loansWithRecoverableFiles: matchesByLoan.size,
    totalFilesToRecover: [...matchesByLoan.values()].reduce((sum, files) => sum + files.length, 0),
  });

  for (const [loanCode, files] of matchesByLoan) {
    console.log(`  [${loanCode}] ${files.length} file(s) from ${path.basename(files[0]!.archive)}`);
  }

  if (!APPLY) {
    console.log('\nDry run only - no writes made. Re-run with --apply to recover these files.');
    return;
  }

  console.log(`\nApplying recovery for ${matchesByLoan.size} loan(s)...`);
  const storage = new LocalFileStorage(env.STORAGE_LOCAL_PATH);
  const loanById = new Map(eligibleLoans.map((l) => [l.loanCode, l.id]));
  let filesRecovered = 0;

  for (const [loanCode, files] of matchesByLoan) {
    const ownerId = loanById.get(loanCode)!;
    for (const entry of files) {
      const buffer = execFileSync(sevenZip, ['x', '-so', entry.archive, entry.internalPath], { maxBuffer: 1024 * 1024 * 512 });
      const baseName = path.basename(entry.internalPath.replace(/\\/g, '/'));
      const ext = path.extname(baseName);
      const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;
      const storageKey = path.posix.join('loan_account', ownerId, `${randomUUID()}${ext}`);
      await storage.save(storageKey, buffer);
      await prisma.attachment.create({
        data: {
          ownerType: 'LOAN_ACCOUNT',
          ownerId,
          fileName: nameWithoutExt,
          fileType: ext,
          fileSize: buffer.length,
          storageKey,
          uploadedAt: entry.modified ?? new Date(),
        },
      });
      filesRecovered++;
    }
    console.log(`  [${loanCode}] recovered ${files.length} file(s)`);
  }

  console.log(`\nDone. ${filesRecovered} file(s) recovered across ${matchesByLoan.size} loan(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
