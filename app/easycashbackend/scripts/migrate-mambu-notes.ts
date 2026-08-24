/* eslint-disable no-console */
/**
 * Mambu (pre-SDevTech, pre-2023) collector/loan-officer notes recovery — imports into the same
 * `ProfileNote` table `migrate-legacy-data.ts`'s `migrateProfileNotes` phase already fills from
 * SDevTech's own `comments` collection. This is a separate, earlier source: Mambu was the system
 * Easycash used before SDevTech, and its `comment` table (MySQL) has 20,707 rows — 18,796 of them
 * tied to a `loanaccount` row via `PARENTKEY`. Never migrated before now.
 *
 * Reads directly from a one-time `easycash.sql` mysqldump export (never connects to a live
 * database, never writes back to the dump — same "never modify legacy data" rule as CP12).
 * `legacy/Easycash-*.zip` -> extract once to `legacy/mambu/easycash.sql` (both gitignored, real
 * client PII) before running this script.
 *
 * Linking: `loanaccount.ID` (Mambu's own human-readable loan code, e.g. "BL-REG_U3V0J") uses the
 * exact same `{productCode}_{code}` format this system's `LoanAccount.loanCode` already does —
 * confirmed 1,190 of 5,699 Mambu loan accounts match a `loanCode` that still exists here. Only
 * those are imported; a comment whose loan never carried forward (closed/never migrated past
 * Mambu) has nowhere to attach and is skipped, not guessed at.
 *
 * Idempotent: upsizes on `legacyId = "mambu:" + comment.ENCODEDKEY` (prefixed so it can never
 * collide with a SDevTech-sourced note's own `legacyId`, even though the two ID formats - Mambu's
 * 32-char hex vs SDevTech's 24-char Mongo ObjectId - already can't overlap by construction).
 *
 * Usage:
 *   npx tsx scripts/migrate-mambu-notes.ts            # dry run — reports counts, writes nothing
 *   npx tsx scripts/migrate-mambu-notes.ts --apply     # actually writes to the configured DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const SQL_PATH = path.resolve(__dirname, '../../../legacy/mambu/easycash.sql');

// ----------------------------------------------------------------------------
// mysqldump extended-INSERT parsing (streams by byte offset, not by line — some address/note text
// in this dump contains literal embedded newlines, which would otherwise truncate a line-based read).
// ----------------------------------------------------------------------------

const BACKSLASH = String.fromCharCode(92);
const SQUOTE = String.fromCharCode(39);

function parseValuesBlock(text: string): string[][] {
  const rows: string[][] = [];
  let i = text.indexOf('VALUES ') + 'VALUES '.length;
  const n = text.length;
  while (i < n) {
    while (i < n && text[i] !== '(') i++;
    if (i >= n) break;
    i++;
    const fields: string[] = [];
    let cur = '';
    let inStr = false;
    while (i < n) {
      const ch = text[i];
      if (inStr) {
        if (ch === BACKSLASH) {
          cur += text[i + 1];
          i += 2;
          continue;
        }
        if (ch === SQUOTE) {
          if (text[i + 1] === SQUOTE) {
            cur += SQUOTE;
            i += 2;
            continue;
          }
          inStr = false;
          i++;
          continue;
        }
        cur += ch;
        i++;
        continue;
      } else {
        if (ch === SQUOTE) {
          inStr = true;
          i++;
          continue;
        }
        if (ch === ',') {
          fields.push(cur);
          cur = '';
          i++;
          continue;
        }
        if (ch === ')') {
          fields.push(cur);
          rows.push(fields);
          i++;
          break;
        }
        cur += ch;
        i++;
        continue;
      }
    }
    while (i < n && text[i] !== '(' && text[i] !== ';') i++;
    if (text[i] === ';') break;
  }
  return rows;
}

/** A table's data can be split across several `INSERT INTO ... VALUES (...),(...)...;` statements
 * in one dump (mysqldump batches large tables) — collects rows from all of them. */
function loadTable(buf: Buffer, tableName: string): string[][] {
  const marker = Buffer.from(`INSERT INTO \`${tableName}\` VALUES`);
  const rows: string[][] = [];
  let pos = 0;
  while (true) {
    const start = buf.indexOf(marker, pos);
    if (start === -1) break;
    const nextInsert = buf.indexOf(Buffer.from('\nINSERT'), start + marker.length);
    const end = nextInsert === -1 ? buf.length : nextInsert;
    rows.push(...parseValuesBlock(buf.subarray(start, end).toString('utf8')));
    pos = end;
  }
  return rows;
}

/** Same rich-text-to-plain-text convention as migrate-legacy-data.ts's own `stripHtml` — Mambu's
 * `comment.TEXT` is occasionally HTML too (see loanaccount.NOTES sample with literal `<div>` tags),
 * and `ProfileNotesPanel.tsx` renders `note.text` as plain text. */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMambuDate(value: string): Date | null {
  if (!value || value === 'NULL') return null;
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

// loanaccount column indices (0-based, matches CREATE TABLE `loanaccount` column order exactly —
// mysqldump never emits an explicit column list here).
const LOANACCOUNT_ENCODEDKEY = 0;
const LOANACCOUNT_ID = 16;

// comment column order: ENCODEDKEY, CREATIONDATE, LASTMODIFIEDDATE, PARENTKEY, TEXT, USERKEY.
const COMMENT_ENCODEDKEY = 0;
const COMMENT_CREATIONDATE = 1;
const COMMENT_PARENTKEY = 3;
const COMMENT_TEXT = 4;

interface Reconciliation {
  sourceCount: number;
  migrated: number;
  skipped: number;
  skipReasons: Map<string, number>;
}

function recordSkip(rec: Reconciliation, reason: string): void {
  rec.skipped++;
  rec.skipReasons.set(reason, (rec.skipReasons.get(reason) ?? 0) + 1);
}

async function main(): Promise<void> {
  console.log(`Mambu notes migration — mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Dump file: ${SQL_PATH}`);
  if (!fs.existsSync(SQL_PATH)) {
    throw new Error(
      `"${SQL_PATH}" not found. Extract legacy/Easycash-*.zip's Easycash/easycash.sql to that path first.`,
    );
  }

  const buf = fs.readFileSync(SQL_PATH);

  console.log('Parsing `loanaccount` table...');
  const loanRows = loadTable(buf, 'loanaccount');
  const mambuIdByEncodedKey = new Map<string, string>();
  for (const r of loanRows) {
    const id = r[LOANACCOUNT_ID];
    if (id && id !== 'NULL') mambuIdByEncodedKey.set(r[LOANACCOUNT_ENCODEDKEY]!, id);
  }
  console.log(`  ${loanRows.length} loan accounts, ${mambuIdByEncodedKey.size} with a readable ID.`);

  console.log('Parsing `comment` table...');
  const commentRows = loadTable(buf, 'comment');
  console.log(`  ${commentRows.length} comments.`);

  console.log('Resolving loan codes against the current database...');
  const candidateLoanCodes = [...new Set(mambuIdByEncodedKey.values())];
  const existingLoans = await prisma.loanAccount.findMany({
    where: { loanCode: { in: candidateLoanCodes } },
    select: { id: true, loanCode: true },
  });
  const loanAccountIdByLoanCode = new Map(existingLoans.map((l) => [l.loanCode, l.id]));
  console.log(`  ${loanAccountIdByLoanCode.size} of ${candidateLoanCodes.length} Mambu loan codes exist in this database.`);

  const rec: Reconciliation = { sourceCount: commentRows.length, migrated: 0, skipped: 0, skipReasons: new Map() };

  for (const c of commentRows) {
    const text = stripHtml(String(c[COMMENT_TEXT] ?? '').trim());
    if (!text) {
      recordSkip(rec, 'empty text (before or after stripping HTML)');
      continue;
    }
    const createdAt = parseMambuDate(c[COMMENT_CREATIONDATE]!);
    if (!createdAt) {
      recordSkip(rec, 'missing/unparseable creation date');
      continue;
    }
    const parentKey = c[COMMENT_PARENTKEY]!;
    const mambuLoanId = mambuIdByEncodedKey.get(parentKey);
    if (!mambuLoanId) {
      recordSkip(rec, 'parent is not a loan account (client/group/other Mambu entity)');
      continue;
    }
    const loanAccountId = loanAccountIdByLoanCode.get(mambuLoanId);
    if (!loanAccountId) {
      recordSkip(rec, 'loan never carried forward past Mambu (closed/not migrated)');
      continue;
    }

    const legacyId = `mambu:${c[COMMENT_ENCODEDKEY]}`;
    if (APPLY) {
      await prisma.profileNote.upsert({
        where: { legacyId },
        update: {},
        create: {
          ownerType: 'LOAN_ACCOUNT',
          ownerId: loanAccountId,
          text,
          authorUserId: null,
          createdAt,
          legacyId,
        },
      });
    }
    rec.migrated++;
  }

  console.log('\n=== Reconciliation ===');
  console.log(`comment: source=${rec.sourceCount} migrated=${rec.migrated} skipped=${rec.skipped}`);
  for (const [reason, count] of rec.skipReasons) {
    console.log(`    skipped (${reason}): ${count}`);
  }
  if (!APPLY) {
    console.log('\nDry run only — no writes made. Re-run with --apply to write these notes.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
