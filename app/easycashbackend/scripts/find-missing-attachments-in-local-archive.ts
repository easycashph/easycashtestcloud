/* eslint-disable no-console */
/**
 * 2026-08-13 (user request) - REPORT ONLY, no writes anywhere. Scans the large, unorganized local
 * archive at E:\201_Files (years 2011-2026, month folders, per-client folders named "<Client Name>
 * - <docType> - <date>.<ext>" or "<Client Name> <loanCode> <CLOSED|INARREARS>...") for candidate
 * document folders belonging to loan accounts that currently have zero or unusually few
 * LOAN_ACCOUNT-owned attachments in the database, so a human can review the matches before any
 * actual import happens. Matching is by normalized borrower name (uppercase, sorted tokens,
 * diacritics stripped) - inherently best-effort given 15 years of inconsistent manual folder
 * naming; every match is reported with its confidence signal (exact vs partial token overlap) for
 * human review, never auto-applied.
 *
 * Usage:
 *   npx tsx scripts/find-missing-attachments-in-local-archive.ts [--root="E:\201_Files"] [--max-attachments=2]
 */
import 'dotenv/config';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';

const rootArg = process.argv.find((a) => a.startsWith('--root='));
const ROOT = rootArg ? rootArg.split('=').slice(1).join('=') : 'E:\\201_Files';
const maxAttachmentsArg = process.argv.find((a) => a.startsWith('--max-attachments='));
// Loan accounts with this many or fewer real attachments are considered "missing/partial" - a
// fully-documented loan typically has 8-20 files (per the naming patterns seen: CIR/COM/COR/LAF/
// PRO/REQ/SPA/VOU document-type codes), so 0-2 is a safe "clearly incomplete" threshold.
const MAX_ATTACHMENTS = maxAttachmentsArg ? Number(maxAttachmentsArg.split('=')[1]) : 2;

const SKIP_DIR_NAMES = new Set(['ECLC CLAUDE CODE', 'MAMBU Reports Generated']);

function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (ñ -> n, á -> a, etc.)
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

interface LocalFolder {
  path: string;
  rawName: string;
  normalizedKey: string;
  fileCount: number;
}

/** Depth-first walk collecting every LEAF folder (a folder with no subfolders, i.e. one that
 * actually holds files directly) as a candidate client-document folder - matches the archive's
 * consistent "...  /  <Client Name> /  <files...>" pattern seen at every depth across years. */
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

  if (subdirs.length === 0) {
    if (files.length === 0) return [];
    return [{ path: dir, rawName: dir.split(/[\\/]/).pop() ?? dir, normalizedKey: normalizeName(dir.split(/[\\/]/).pop() ?? ''), fileCount: files.length }];
  }

  const results: LocalFolder[] = [];
  // A folder can be BOTH a leaf-ish client folder AND have subfolders in this messy archive (e.g.
  // "Client Name .../Client Name CLOSED" nesting) - if this dir itself has files directly, record
  // it too, not just its subdirectories.
  if (files.length > 0) {
    results.push({ path: dir, rawName: dir.split(/[\\/]/).pop() ?? dir, normalizedKey: normalizeName(dir.split(/[\\/]/).pop() ?? ''), fileCount: files.length });
  }
  for (const sub of subdirs) {
    results.push(...(await collectLeafFolders(join(dir, sub.name), depth + 1, maxDepth)));
  }
  return results;
}

async function main(): Promise<void> {
  console.log(`Scanning local archive at "${ROOT}" for candidate document folders (this can take a few minutes)...`);
  const startTime = Date.now();

  const topEntries = await readdir(ROOT, { withFileTypes: true });
  const topDirs = topEntries.filter((e) => e.isDirectory() && !SKIP_DIR_NAMES.has(e.name));

  const allFolders: LocalFolder[] = [];
  for (const top of topDirs) {
    const topPath = join(ROOT, top.name);
    // Depth budget: root -> year -> month -> client (or root -> client directly, as seen for some
    // years) -> possible one more nesting level for "...CLOSED/Client Name CLOSED" style folders.
    allFolders.push(...(await collectLeafFolders(topPath, 0, 4)));
  }
  console.log(`Found ${allFolders.length} candidate document folders across ${topDirs.length} top-level entries in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);

  // Index local folders by normalized name key -> list of matching folders (a name can recur
  // across years for renewals, so keep all matches, not just the first).
  const byNormalizedKey = new Map<string, LocalFolder[]>();
  for (const folder of allFolders) {
    if (!folder.normalizedKey) continue;
    const list = byNormalizedKey.get(folder.normalizedKey) ?? [];
    list.push(folder);
    byNormalizedKey.set(folder.normalizedKey, list);
  }

  // Loan accounts needing attention: 0 or few real (non-placeholder) LOAN_ACCOUNT attachments.
  const loanAccounts = await prisma.loanAccount.findMany({
    select: {
      id: true,
      loanCode: true,
      status: true,
      borrower: { select: { firstName: true, middleName: true, lastName: true } },
    },
  });

  const attachmentCounts = await prisma.attachment.groupBy({
    by: ['ownerId'],
    where: { ownerType: 'LOAN_ACCOUNT', storageKey: { not: { startsWith: 'legacy-unmigrated:' } } },
    _count: { id: true },
  });
  const countByOwnerId = new Map(attachmentCounts.map((row) => [row.ownerId, row._count.id]));

  const needsAttention = loanAccounts.filter((la) => (countByOwnerId.get(la.id) ?? 0) <= MAX_ATTACHMENTS);
  console.log(`\n${needsAttention.length} of ${loanAccounts.length} loan accounts have ${MAX_ATTACHMENTS} or fewer real attachments on file.\n`);

  let exactMatches = 0;
  let partialMatches = 0;
  let noMatches = 0;
  const results: { loanCode: string; borrowerName: string; currentAttachments: number; matchType: string; folders: LocalFolder[] }[] = [];

  for (const la of needsAttention) {
    const fullName = [la.borrower.firstName, la.borrower.middleName, la.borrower.lastName].filter(Boolean).join(' ');
    const key = normalizeName(fullName);
    const exact = byNormalizedKey.get(key);
    if (exact && exact.length > 0) {
      exactMatches++;
      results.push({ loanCode: la.loanCode, borrowerName: fullName, currentAttachments: countByOwnerId.get(la.id) ?? 0, matchType: 'EXACT', folders: exact });
      continue;
    }

    // Partial match: this borrower's name tokens are a SUBSET of a local folder's tokens (or vice
    // versa) - catches cases like a missing/extra middle name or suffix (Jr/Sr) between the two
    // sources.
    const nameTokens = new Set(key.split(' '));
    let bestPartial: LocalFolder[] = [];
    for (const [folderKey, folders] of byNormalizedKey) {
      const folderTokens = new Set(folderKey.split(' '));
      const overlap = [...nameTokens].filter((t) => folderTokens.has(t));
      const isSubsetMatch =
        nameTokens.size >= 2 && overlap.length >= Math.min(nameTokens.size, folderTokens.size) && overlap.length >= 2;
      if (isSubsetMatch) bestPartial = bestPartial.concat(folders);
    }
    if (bestPartial.length > 0) {
      partialMatches++;
      results.push({ loanCode: la.loanCode, borrowerName: fullName, currentAttachments: countByOwnerId.get(la.id) ?? 0, matchType: 'PARTIAL', folders: bestPartial });
    } else {
      noMatches++;
      results.push({ loanCode: la.loanCode, borrowerName: fullName, currentAttachments: countByOwnerId.get(la.id) ?? 0, matchType: 'NO_MATCH', folders: [] });
    }
  }

  console.log(`=== Summary ===`);
  console.log(`Exact name match found in local archive: ${exactMatches}`);
  console.log(`Partial name match found in local archive: ${partialMatches}`);
  console.log(`No match found in local archive: ${noMatches}`);

  console.log(`\n=== Exact matches (highest confidence - review then import) ===`);
  for (const r of results.filter((r) => r.matchType === 'EXACT')) {
    const totalFiles = r.folders.reduce((sum, f) => sum + f.fileCount, 0);
    console.log(`[${r.loanCode}] ${r.borrowerName} (currently ${r.currentAttachments} on file) -> ${r.folders.length} folder(s), ${totalFiles} file(s):`);
    for (const f of r.folders) console.log(`    ${f.path} (${f.fileCount} files)`);
  }

  console.log(`\n=== Partial matches (verify manually before importing) ===`);
  for (const r of results.filter((r) => r.matchType === 'PARTIAL')) {
    const totalFiles = r.folders.reduce((sum, f) => sum + f.fileCount, 0);
    console.log(`[${r.loanCode}] ${r.borrowerName} (currently ${r.currentAttachments} on file) -> ${r.folders.length} folder(s), ${totalFiles} file(s):`);
    for (const f of r.folders) console.log(`    ${f.path} (${f.fileCount} files)`);
  }

  console.log(`\n=== No local match found (${noMatches}) ===`);
  for (const r of results.filter((r) => r.matchType === 'NO_MATCH')) {
    console.log(`[${r.loanCode}] ${r.borrowerName} (currently ${r.currentAttachments} on file)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
