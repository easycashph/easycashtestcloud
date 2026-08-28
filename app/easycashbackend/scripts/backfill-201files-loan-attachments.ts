/* eslint-disable no-console */
/**
 * 2026-08-27 (user request): sibling of `backfill-mambu-loan-attachments.ts`, same matching rule
 * and same purpose (recover real files for loan accounts with ZERO Attachment rows), but against a
 * different, much larger source: `E:\201_Files` on this machine (Office Server PC) - the office's
 * long-running "201 file" (client document) archive, organized by year (2011-2026) then month, with
 * one plain folder per loan (`<LoanCode> - <Client Name>` or `<Client Name> <LoanCode>`, format
 * varies by era/staff member who filed it). Unlike the Mambu backup, this is NOT checked into git
 * (huge, machine-local, real client PII) and NOT limited to 2023 - it's actively added to by staff
 * through 2026, so recoverable loans skew toward more RECENT gaps than the Mambu archive did.
 *
 * `SOURCE_DIR` is deliberately not repo-relative (this archive lives outside the repo, on a drive
 * letter specific to this machine) - override via the `TWO_OH_ONE_FILES_DIR` env var if it's ever
 * mounted somewhere else, or on another machine.
 *
 * Matching rule identical to `backfill-mambu-loan-attachments.ts` (see that script's own doc comment
 * for the full rationale): only alphabetic-prefixed loan codes are trusted (numeric legacy codes are
 * too ambiguous), and a file is attributed to a loan only when the code appears in its IMMEDIATE
 * parent folder - never an ancestor - so nested per-loan subfolders (co-borrowers, batches) are
 * attributed correctly instead of being swept into a parent loan.
 *
 * Idempotent by construction - only ever considers a loan account with zero existing Attachment
 * rows, so a second run (e.g. after this archive gains more folders) only picks up what's new.
 *
 * Usage:
 *   npx tsx scripts/backfill-201files-loan-attachments.ts            # dry run — reports only
 *   npx tsx scripts/backfill-201files-loan-attachments.ts --apply    # writes files + DB rows
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const SOURCE_DIR = process.env.TWO_OH_ONE_FILES_DIR ?? 'E:\\201_Files';

// Same prefixes as backfill-mambu-loan-attachments.ts's LOAN_CODE_PATTERN.
const LOAN_CODE_PATTERN = /^(BL|SL|SML|PFL|OTH|SP)-[A-Za-z-]+_[A-Za-z0-9]+$/;

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // permission-denied or transient FS error - skip, don't crash the whole scan
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

function loanCodeBoundaryMatch(folderName: string, loanCode: string): boolean {
  const escaped = loanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}($|[^A-Za-z0-9_])`).test(folderName);
}

async function main(): Promise<void> {
  console.log(`201_Files loan-attachment recovery — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Source dir: ${SOURCE_DIR}`);
  if (!fs.existsSync(SOURCE_DIR)) throw new Error(`"${SOURCE_DIR}" not found on this machine.`);

  console.log('Scanning archive (this may take a moment - ~75,000 files)...');
  const allFiles: string[] = [];
  walk(SOURCE_DIR, allFiles);
  console.log(`Total files found: ${allFiles.length}`);

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

  const matchesByLoan = new Map<string, string[]>();
  for (const loan of eligibleLoans) {
    const matches = allFiles.filter((f) => loanCodeBoundaryMatch(path.basename(path.dirname(f)), loan.loanCode));
    if (matches.length > 0) matchesByLoan.set(loan.loanCode, matches);
  }

  console.log(`\n=== Reconciliation ===`);
  console.log({
    eligibleLoans: eligibleLoans.length,
    loansWithRecoverableFiles: matchesByLoan.size,
    totalFilesToRecover: [...matchesByLoan.values()].reduce((sum, files) => sum + files.length, 0),
  });

  for (const [loanCode, files] of matchesByLoan) {
    console.log(`  [${loanCode}] ${files.length} file(s)`);
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
    for (const filePath of files) {
      const buffer = fs.readFileSync(filePath);
      const baseName = path.basename(filePath);
      const ext = path.extname(baseName);
      const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;
      const storageKey = path.posix.join('loan_account', ownerId, `${randomUUID()}${ext}`);
      await storage.save(storageKey, buffer);
      const stat = fs.statSync(filePath);
      await prisma.attachment.create({
        data: {
          ownerType: 'LOAN_ACCOUNT',
          ownerId,
          fileName: nameWithoutExt,
          fileType: ext,
          fileSize: buffer.length,
          storageKey,
          uploadedAt: stat.mtime,
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
