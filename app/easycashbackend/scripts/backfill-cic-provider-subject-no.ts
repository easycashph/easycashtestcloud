/**
 * One-time backfill (2026-08-30, user-confirmed): populates `Borrower.cicProviderSubjectNo` for
 * clients who were already submitted to CIC before this feature existed, using the company's own
 * historical "Client Master List" (an Excel export of the Google Sheet used for the old manual
 * process) as the source of truth for their permanent Provider Subject No ("Macro Provided ID"
 * column).
 *
 * That list's own "Client ID" column does NOT correspond to any ID this system stores (verified:
 * neither this LMS's `Borrower.legacyId` nor any raw SDevTech MongoDB collection contains it - it
 * traces to an older, pre-SDevTech system) - so matching is done by identity instead: mobile
 * number, then email, then exact first+last name + birth date, each only accepted when it resolves
 * to exactly ONE Borrower (an ambiguous match is left alone and reported, never guessed).
 *
 * Never overwrites an existing `cicProviderSubjectNo` - once CIC has a client on file under a
 * value, changing it would sever their credit history (see the field's own schema doc comment).
 *
 * Usage:
 *   npx tsx scripts/backfill-cic-provider-subject-no.ts              # dry run - reports only
 *   npx tsx scripts/backfill-cic-provider-subject-no.ts --apply      # writes matches
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

// July's Client Master List is the most recently maintained copy on file.
const SOURCE_FILE = path.resolve(
  __dirname,
  '../../../legacy/CIC/07 2026 July/[July 2026] Fields in Google Spreadsheet.xlsx',
);

interface MasterListRow {
  clientId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  birthDate: Date | null;
  macroProvidedId: string;
}

function normalizePhone(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\D/g, '').replace(/^63/, '0').replace(/^9/, '09').trim();
}

function normalizeText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().toUpperCase();
}

async function loadMasterList(): Promise<MasterListRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);
  const sheet = workbook.getWorksheet('Client Master List');
  if (!sheet) throw new Error(`"Client Master List" sheet not found in ${SOURCE_FILE}`);

  const rows: MasterListRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const get = (col: number) => row.getCell(col).value;
    const macroProvidedId = String(get(26) ?? '').trim(); // column Z
    if (!macroProvidedId) return; // nothing to backfill from this row

    const birthRaw = get(8);
    const birthDate = birthRaw instanceof Date ? birthRaw : null;

    rows.push({
      clientId: String(get(1) ?? '').trim(),
      firstName: normalizeText(get(4)),
      lastName: normalizeText(get(5)),
      mobile: normalizePhone(get(11)),
      email: normalizeText(get(12)),
      birthDate,
      macroProvidedId,
    });
  });
  return rows;
}

async function main(): Promise<void> {
  console.log(`=== CIC Provider Subject No backfill (${APPLY ? 'APPLY' : 'dry run'}) ===`);
  console.log(`Source: ${SOURCE_FILE}`);

  const masterRows = await loadMasterList();
  console.log(`Loaded ${masterRows.length} Client Master List row(s) with a Macro Provided ID.`);

  const borrowers = await prisma.borrower.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobilePhone1: true,
      mobilePhone2: true,
      email: true,
      birthDate: true,
      cicProviderSubjectNo: true,
    },
  });

  const byMobile = new Map<string, typeof borrowers>();
  const byEmail = new Map<string, typeof borrowers>();
  const byNameDob = new Map<string, typeof borrowers>();
  for (const b of borrowers) {
    for (const phone of [b.mobilePhone1, b.mobilePhone2]) {
      const norm = normalizePhone(phone);
      if (!norm) continue;
      if (!byMobile.has(norm)) byMobile.set(norm, []);
      byMobile.get(norm)!.push(b);
    }
    const email = normalizeText(b.email);
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email)!.push(b);
    }
    if (b.birthDate) {
      const key = `${normalizeText(b.firstName)}|${normalizeText(b.lastName)}|${b.birthDate.toISOString().slice(0, 10)}`;
      if (!byNameDob.has(key)) byNameDob.set(key, []);
      byNameDob.get(key)!.push(b);
    }
  }

  let matched = 0;
  let alreadySet = 0;
  let ambiguous = 0;
  let unmatched = 0;
  const ambiguousRows: MasterListRow[] = [];
  const unmatchedRows: MasterListRow[] = [];

  for (const row of masterRows) {
    let candidates: typeof borrowers | undefined;
    let strategy = '';

    if (row.mobile && byMobile.has(row.mobile)) {
      candidates = byMobile.get(row.mobile);
      strategy = 'mobile';
    } else if (row.email && byEmail.has(row.email)) {
      candidates = byEmail.get(row.email);
      strategy = 'email';
    } else if (row.birthDate) {
      const key = `${row.firstName}|${row.lastName}|${row.birthDate.toISOString().slice(0, 10)}`;
      if (byNameDob.has(key)) {
        candidates = byNameDob.get(key);
        strategy = 'name+dob';
      }
    }

    if (!candidates || candidates.length === 0) {
      unmatched++;
      unmatchedRows.push(row);
      continue;
    }

    const uniqueBorrowerIds = new Set(candidates.map((c) => c.id));
    if (uniqueBorrowerIds.size > 1) {
      ambiguous++;
      ambiguousRows.push(row);
      continue;
    }

    const borrower = candidates[0];
    if (borrower.cicProviderSubjectNo) {
      alreadySet++;
      continue;
    }

    matched++;
    console.log(`  [${strategy}] ${row.firstName} ${row.lastName} -> ${row.macroProvidedId} (borrower ${borrower.id})`);
    if (APPLY) {
      await prisma.borrower.update({
        where: { id: borrower.id },
        data: { cicProviderSubjectNo: row.macroProvidedId },
      });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Matched (${APPLY ? 'written' : 'would write'}): ${matched}`);
  console.log(`Already had a value (skipped, not overwritten): ${alreadySet}`);
  console.log(`Ambiguous (multiple Borrowers matched - not touched): ${ambiguous}`);
  console.log(`Unmatched (no Borrower found - not touched): ${unmatched}`);

  if (ambiguousRows.length > 0) {
    console.log('\nAmbiguous rows (need manual review):');
    for (const r of ambiguousRows.slice(0, 30)) console.log(`  ${r.clientId} ${r.firstName} ${r.lastName} (${r.macroProvidedId})`);
    if (ambiguousRows.length > 30) console.log(`  ... and ${ambiguousRows.length - 30} more`);
  }
  if (unmatchedRows.length > 0) {
    console.log('\nUnmatched rows (no Borrower found in this LMS - probably fine if pre-LMS/no active loan):');
    for (const r of unmatchedRows.slice(0, 30)) console.log(`  ${r.clientId} ${r.firstName} ${r.lastName} (${r.macroProvidedId})`);
    if (unmatchedRows.length > 30) console.log(`  ... and ${unmatchedRows.length - 30} more`);
  }

  if (!APPLY) console.log('\nDry run only - re-run with --apply to write these changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
