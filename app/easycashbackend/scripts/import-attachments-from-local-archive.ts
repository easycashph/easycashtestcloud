/* eslint-disable no-console */
/**
 * 2026-08-13 (user request) - imports real attachment files for loan accounts whose borrower name
 * EXACTLY matches a client-document folder somewhere in the large local archive at E:\201_Files
 * (same scan/normalize logic as find-missing-attachments-in-local-archive.ts's report - re-run
 * here rather than consuming that report's text output, so this script is self-contained and safe
 * to re-run standalone). Only ever touches loan accounts identified as EXACT matches - PARTIAL
 * matches are intentionally excluded here, since those need human verification first (see the
 * report script's own doc comment on match confidence).
 *
 * A loan can have MULTIPLE matched folders (e.g. duplicated across years, or a "UN" subfolder
 * mirroring its parent) - files are deduped per loan by (normalized fileName + extension + byte
 * size), so an identical file appearing in two folders is only imported once.
 *
 * Idempotent: each imported Attachment is upserted on `legacyId` = the file's absolute local path
 * (prefixed `local-archive:`), so re-running only fills in anything still missing.
 *
 * Usage:
 *   npx tsx scripts/import-attachments-from-local-archive.ts [--root="E:\201_Files"] [--max-attachments=2]
 *   npx tsx scripts/import-attachments-from-local-archive.ts --apply   # actually write files + DB rows
 */
import 'dotenv/config';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';
import { LocalFileStorage } from '../src/shared/infrastructure/LocalFileStorage';
import { env } from '../src/shared/config/env';

const APPLY = process.argv.includes('--apply');
const rootArg = process.argv.find((a) => a.startsWith('--root='));
const ROOT = rootArg ? rootArg.split('=').slice(1).join('=') : 'E:\\201_Files';
const maxAttachmentsArg = process.argv.find((a) => a.startsWith('--max-attachments='));
const MAX_ATTACHMENTS = maxAttachmentsArg ? Number(maxAttachmentsArg.split('=')[1]) : 2;

const SKIP_DIR_NAMES = new Set(['ECLC CLAUDE CODE', 'MAMBU Reports Generated']);
const LEGACY_ID_PREFIX = 'local-archive:';

function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

interface LocalFolder {
  path: string;
  normalizedKey: string;
}

async function collectLeafFolders(dir: string, depth: number, maxDepth: number): Promise<LocalFolder[]> {
  if (depth > maxDepth) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const subdirs = entries.filter((e) => e.isDirectory() && !SKIP_DIR_NAMES.has(e.name));
  const files = entries.filter((e) => e.isFile());

  const results: LocalFolder[] = [];
  if (files.length > 0) {
    results.push({ path: dir, normalizedKey: normalizeName(dir.split(/[\\/]/).pop() ?? '') });
  }
  for (const sub of subdirs) {
    results.push(...(await collectLeafFolders(join(dir, sub.name), depth + 1, maxDepth)));
  }
  return results;
}

interface Reconciliation {
  loansConsidered: number;
  ambiguousBorrowersSkipped: number;
  filesConsidered: number;
  duplicatesSkipped: number;
  alreadyImported: number;
  imported: number;
}

async function main(): Promise<void> {
  console.log(`Import from local archive — mode: ${APPLY ? 'APPLY (writing files + DB)' : 'DRY RUN (no writes)'}`);

  const storage = new LocalFileStorage(resolve(env.STORAGE_LOCAL_PATH));

  console.log(`Scanning "${ROOT}"...`);
  const topEntries = await readdir(ROOT, { withFileTypes: true });
  const topDirs = topEntries.filter((e) => e.isDirectory() && !SKIP_DIR_NAMES.has(e.name));
  const allFolders: LocalFolder[] = [];
  for (const top of topDirs) {
    allFolders.push(...(await collectLeafFolders(join(ROOT, top.name), 0, 4)));
  }
  const byNormalizedKey = new Map<string, LocalFolder[]>();
  for (const folder of allFolders) {
    if (!folder.normalizedKey) continue;
    const list = byNormalizedKey.get(folder.normalizedKey) ?? [];
    list.push(folder);
    byNormalizedKey.set(folder.normalizedKey, list);
  }
  console.log(`Found ${allFolders.length} candidate folders.\n`);

  const loanAccounts = await prisma.loanAccount.findMany({
    select: { id: true, loanCode: true, borrowerId: true, borrower: { select: { firstName: true, middleName: true, lastName: true } } },
  });
  const attachmentCounts = await prisma.attachment.groupBy({
    by: ['ownerId'],
    where: { ownerType: 'LOAN_ACCOUNT', storageKey: { not: { startsWith: 'legacy-unmigrated:' } } },
    _count: { id: true },
  });
  const countByOwnerId = new Map(attachmentCounts.map((row) => [row.ownerId, row._count.id]));
  const needsAttention = loanAccounts.filter((la) => (countByOwnerId.get(la.id) ?? 0) <= MAX_ATTACHMENTS);

  // 2026-08-13 (bug caught before --apply, confirmed via a live DB query): 40 borrowers have MORE
  // THAN ONE loan account needing attention at once (some as many as 10). Matching is by borrower
  // NAME only - it can't tell which loan cycle a given local file belongs to, so blindly importing
  // for every one of that borrower's loans would attach the exact same files to every one of them
  // (wrong, and silently multiplies storage use). Those borrowers are excluded here entirely and
  // reported separately - they need a smarter per-loan disambiguation pass (e.g. by date range or
  // the old "A2366"-style account number visible in each filename), not this script.
  const loanCountByBorrowerId = new Map<string, number>();
  for (const la of needsAttention) {
    loanCountByBorrowerId.set(la.borrowerId, (loanCountByBorrowerId.get(la.borrowerId) ?? 0) + 1);
  }
  const ambiguousBorrowerIds = new Set([...loanCountByBorrowerId.entries()].filter(([, count]) => count > 1).map(([id]) => id));

  const rec: Reconciliation = { loansConsidered: 0, ambiguousBorrowersSkipped: 0, filesConsidered: 0, duplicatesSkipped: 0, alreadyImported: 0, imported: 0 };
  const ambiguousSkippedLoans: string[] = [];

  for (const la of needsAttention) {
    if (ambiguousBorrowerIds.has(la.borrowerId)) {
      rec.ambiguousBorrowersSkipped++;
      ambiguousSkippedLoans.push(la.loanCode);
      continue;
    }
    const fullName = [la.borrower.firstName, la.borrower.middleName, la.borrower.lastName].filter(Boolean).join(' ');
    const key = normalizeName(fullName);
    const matchedFolders = byNormalizedKey.get(key);
    if (!matchedFolders || matchedFolders.length === 0) continue; // not an EXACT match - out of scope for this script

    rec.loansConsidered++;

    // Gather every file across every matched folder, deduping by (name + ext + size).
    const seen = new Set<string>();
    const filesToImport: { absolutePath: string; fileName: string; fileType: string; fileSize: number }[] = [];
    for (const folder of matchedFolders) {
      let entries;
      try {
        entries = await readdir(folder.path, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const absolutePath = join(folder.path, entry.name);
        const ext = extname(entry.name);
        const nameWithoutExt = entry.name.slice(0, entry.name.length - ext.length);
        const stats = await stat(absolutePath);
        const dedupeKey = `${nameWithoutExt.toUpperCase()}${ext.toLowerCase()}:${stats.size}`;
        if (seen.has(dedupeKey)) {
          rec.duplicatesSkipped++;
          continue;
        }
        seen.add(dedupeKey);
        filesToImport.push({ absolutePath, fileName: nameWithoutExt, fileType: ext, fileSize: stats.size });
      }
    }

    for (const file of filesToImport) {
      rec.filesConsidered++;
      const legacyId = `${LEGACY_ID_PREFIX}${file.absolutePath}`;

      const existing = await prisma.attachment.findUnique({ where: { legacyId } });
      if (existing) {
        rec.alreadyImported++;
        continue;
      }

      console.log(`  [${la.loanCode}] importing "${file.fileName}${file.fileType}" (${file.fileSize} bytes) from ${file.absolutePath}`);
      if (!APPLY) {
        rec.imported++;
        continue;
      }

      const buffer = await readFile(file.absolutePath);
      const attachmentId = crypto.randomUUID();
      const storageKey = `loan_account/${la.id}/${attachmentId}${file.fileType}`;
      await storage.save(storageKey, buffer);
      await prisma.attachment.create({
        data: {
          id: attachmentId,
          ownerType: 'LOAN_ACCOUNT',
          ownerId: la.id,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: buffer.length,
          storageKey,
          legacyId,
        },
      });
      rec.imported++;
    }
  }

  console.log('\n=== Reconciliation ===');
  console.log(`loans considered (EXACT matches only): ${rec.loansConsidered}`);
  console.log(`loans skipped (borrower has multiple loans needing attention - ambiguous): ${rec.ambiguousBorrowersSkipped}`);
  if (ambiguousSkippedLoans.length > 0) console.log(`    skipped loan codes: ${ambiguousSkippedLoans.join(', ')}`);
  console.log(`files considered: ${rec.filesConsidered}`);
  console.log(`duplicates skipped (same name+ext+size within a loan): ${rec.duplicatesSkipped}`);
  console.log(`already imported (idempotent skip): ${rec.alreadyImported}`);
  console.log(`imported: ${rec.imported}`);
  if (!APPLY) console.log('\nDry run only — re-run with --apply to actually write files and DB rows.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
