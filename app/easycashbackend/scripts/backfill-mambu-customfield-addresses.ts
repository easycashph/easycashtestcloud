/* eslint-disable no-console */
/**
 * Mambu (pre-SDevTech, pre-2023) address recovery via Mambu's CUSTOM FIELDS — not Mambu's own
 * built-in `address` table, which only ever held 14 branch/office rows (confirmed empirically,
 * same check `migrate-mambu-notes.ts` and this script both do for their own tables). Easycash
 * actually captured client addresses as `CLIENT_INFO` custom fields instead, under two field
 * groups:
 *   1. "Present Address": hm_addr_pre_unit / _brgy / _city / _zip / _full
 *   2. A second, unprefixed group: hm_addr_unit / _street / _brgy / _city / _zipcode
 * ("Permanent Address" - hm_addr_per_* - was checked too during the original 2026-08-21/25
 * recovery and found to add only 1 more client; not worth its own pass here either.)
 *
 * REPLACES a pair of one-off, same-turn-deleted recovery scripts from 2026-08-21/25 (see
 * `docs/session-logs/Office Server PC/SESSION_LOG_2026-08-14_office_server_move_and_manual_payment_adjustment.md`
 * §46) that recovered 1,040 of 1,106 then-addressless legacy borrowers this same way, reading from
 * a throwaway MySQL container rather than this repo's own BSON-style buffer parser. That recovery
 * had NO permanent, re-runnable script behind it - a 2026-08-27 full local re-migration
 * (`prisma migrate reset --force`) silently wiped all 1,040 rows with nothing to bring them back,
 * since they don't exist in SDevTech's own Mongo export at all. This script exists so that never
 * happens again: safe to re-run after any future reset (or as a step in the full-migration .bat
 * files, once the Mambu SQL dump's own presence there is confirmed).
 *
 * Reads directly from the same one-time `easycash.sql` mysqldump export `migrate-mambu-notes.ts`
 * uses (never connects to a live database, never writes back to the dump). `legacy/Easycash-*.zip`
 * -> extract once to `legacy/mambu/easycash.sql` (gitignored, real client PII) before running this.
 *
 * Linking: `customfieldvalue.PARENTKEY` (a Mambu `client.ENCODEDKEY`) matches this system's
 * `Borrower.legacyId` directly - SDevTech's own `client_accounts.uid` field IS the original Mambu
 * `client.ENCODEDKEY` (established during `migrate-mambu-notes.ts`'s own investigation), and
 * `Borrower.legacyId` is populated from that same `uid`.
 *
 * Conservative by design, matching the original recovery's own rule: only ever inserts an address
 * for a borrower that CURRENTLY has zero rows in `addresses` - never overwrites or duplicates an
 * existing one (SDevTech-sourced, a prior run of this same script, or a staff manual edit).
 * Idempotent as a natural consequence of that same check - a borrower who already has an address
 * (from an earlier run of this script) is simply skipped on the next run.
 *
 * Usage:
 *   npx tsx scripts/backfill-mambu-customfield-addresses.ts            # dry run — reports only
 *   npx tsx scripts/backfill-mambu-customfield-addresses.ts --apply    # writes to DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const SQL_PATH = path.resolve(__dirname, '../../../legacy/mambu/easycash.sql');

// ----------------------------------------------------------------------------
// mysqldump extended-INSERT parsing - identical to migrate-mambu-notes.ts's own (streams by byte
// offset, not by line - some address/note text in this dump contains literal embedded newlines).
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

function clean(value: string | undefined): string | null {
  if (!value || value === 'NULL') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// customfield column order: ENCODEDKEY, ID, CREATIONDATE, LASTMODIFIEDDATE, DATATYPE, ISDEFAULT,
// ISREQUIRED, NAME, VALUES, AMOUNTS, DESCRIPTION, TYPE, VALUELENGTH, INDEXINLIST,
// CUSTOMFIELDSET_ENCODEDKEY_OID, ...
const CUSTOMFIELD_ENCODEDKEY = 0;
const CUSTOMFIELD_ID = 1;

// customfieldvalue column order: ENCODEDKEY, CUSTOMFIELDKEY, INDEXINLIST, PARENTKEY, VALUE, ...
const CFV_CUSTOMFIELDKEY = 1;
const CFV_PARENTKEY = 3;
const CFV_VALUE = 4;

/** Group 1: "Present Address" - has its own combined free-text field (`_full`), no separate
 * `street` field of its own. */
const PRESENT_FIELD_IDS = {
  unit: 'hm_addr_pre_unit',
  brgy: 'hm_addr_pre_brgy',
  city: 'hm_addr_pre_city',
  zip: 'hm_addr_pre_zip',
  full: 'hm_addr_pre_full',
};

/** Group 2: the unprefixed/"generic" field group - has its own explicit `street` field. */
const GENERIC_FIELD_IDS = {
  unit: 'hm_addr_unit',
  street: 'hm_addr_street',
  brgy: 'hm_addr_brngy', // [sic] - genuine typo in the source field ID, not ours
  city: 'hm_addr_city',
  zip: 'hm_addr_zipcode',
};

interface RecoveredAddress {
  houseUnitNumber: string | null;
  street: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  zipCode: string | null;
}

async function main(): Promise<void> {
  console.log(`Mambu custom-field address recovery — mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Dump file: ${SQL_PATH}`);
  if (!fs.existsSync(SQL_PATH)) {
    throw new Error(`"${SQL_PATH}" not found. Extract legacy/Easycash-*.zip's Easycash/easycash.sql to that path first.`);
  }

  const buf = fs.readFileSync(SQL_PATH);

  console.log('Parsing `customfield` table...');
  const customFieldRows = loadTable(buf, 'customfield');
  const customFieldKeyById = new Map<string, string>();
  for (const r of customFieldRows) {
    const id = r[CUSTOMFIELD_ID];
    if (id) customFieldKeyById.set(id, r[CUSTOMFIELD_ENCODEDKEY]!);
  }

  const presentKeys = Object.fromEntries(
    Object.entries(PRESENT_FIELD_IDS).map(([k, id]) => [k, customFieldKeyById.get(id)]),
  ) as Record<keyof typeof PRESENT_FIELD_IDS, string | undefined>;
  const genericKeys = Object.fromEntries(
    Object.entries(GENERIC_FIELD_IDS).map(([k, id]) => [k, customFieldKeyById.get(id)]),
  ) as Record<keyof typeof GENERIC_FIELD_IDS, string | undefined>;

  for (const [group, keys] of [['Present', presentKeys] as const, ['Generic', genericKeys] as const]) {
    for (const [field, key] of Object.entries(keys)) {
      if (!key) throw new Error(`Could not resolve customfield ENCODEDKEY for ${group}.${field} - dump schema may have changed.`);
    }
  }

  console.log('Parsing `customfieldvalue` table (this is the largest table read here - may take a moment)...');
  const cfvRows = loadTable(buf, 'customfieldvalue');
  console.log(`  ${cfvRows.length} custom field values total.`);

  // clientKey -> fieldKey -> value, built in one pass over every row (cheap: a handful of target
  // field keys checked per row, not a full second scan per field).
  const targetFieldKeys = new Set([...Object.values(presentKeys), ...Object.values(genericKeys)].filter(Boolean) as string[]);
  const valuesByClientAndField = new Map<string, Map<string, string>>();
  for (const r of cfvRows) {
    const fieldKey = r[CFV_CUSTOMFIELDKEY]!;
    if (!targetFieldKeys.has(fieldKey)) continue;
    const clientKey = r[CFV_PARENTKEY]!;
    const value = clean(r[CFV_VALUE]);
    if (!value) continue;
    const perClient = valuesByClientAndField.get(clientKey) ?? new Map<string, string>();
    perClient.set(fieldKey, value);
    valuesByClientAndField.set(clientKey, perClient);
  }
  console.log(`  ${valuesByClientAndField.size} distinct clients have at least one target address field.`);

  function buildAddress(clientKey: string, keys: Record<string, string | undefined>): RecoveredAddress | null {
    const values = valuesByClientAndField.get(clientKey);
    if (!values) return null;
    const get = (field: string): string | null => {
      const key = keys[field];
      return key ? (values.get(key) ?? null) : null;
    };
    const houseUnitNumber = get('unit');
    const street = get('street') ?? get('full'); // Present-address group has no separate street
    // field - its combined free-text "full" address is the closest equivalent, so it goes here
    // rather than being discarded.
    const barangay = get('brgy');
    const cityMunicipality = get('city');
    const zipCode = get('zip');
    if (!houseUnitNumber && !street && !barangay && !cityMunicipality && !zipCode) return null;
    return { houseUnitNumber, street, barangay, cityMunicipality, zipCode };
  }

  console.log('Finding addressless borrowers in the live database...');
  // Address is a polymorphic table (ownerType/ownerId), not a Prisma relation on Borrower - fetch
  // the set of borrower IDs that already have one separately, same pattern used elsewhere in this
  // codebase for the same polymorphic-table shape.
  const legacyBorrowers = await prisma.borrower.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true, firstName: true, lastName: true },
  });
  const borrowerIdsWithAddress = new Set(
    (await prisma.address.findMany({ where: { ownerType: 'BORROWER' }, select: { ownerId: true } })).map((a) => a.ownerId),
  );
  const addresslessBorrowers = legacyBorrowers.filter((b) => !borrowerIdsWithAddress.has(b.id));
  console.log(`  ${addresslessBorrowers.length} legacy-migrated borrowers currently have zero addresses.`);

  let presentRecovered = 0;
  let genericRecovered = 0;
  let noSourceData = 0;
  const toApply: { borrowerId: string; name: string; source: string; address: RecoveredAddress }[] = [];

  for (const b of addresslessBorrowers) {
    const clientKey = b.legacyId!;
    const present = buildAddress(clientKey, presentKeys);
    if (present) {
      presentRecovered++;
      toApply.push({ borrowerId: b.id, name: `${b.firstName} ${b.lastName}`, source: 'Present Address', address: present });
      continue;
    }
    const generic = buildAddress(clientKey, genericKeys);
    if (generic) {
      genericRecovered++;
      toApply.push({ borrowerId: b.id, name: `${b.firstName} ${b.lastName}`, source: 'generic hm_addr_* fields', address: generic });
      continue;
    }
    noSourceData++;
  }

  console.log('\n=== Reconciliation ===');
  console.log({
    addresslessBorrowers: addresslessBorrowers.length,
    recoveredFromPresentAddress: presentRecovered,
    recoveredFromGenericFields: genericRecovered,
    totalRecovered: toApply.length,
    noMambuSourceData: noSourceData,
  });

  console.log(`\nSample of ${Math.min(10, toApply.length)} recoveries:`);
  for (const r of toApply.slice(0, 10)) {
    console.log(`  ${r.name} (${r.source}): ${JSON.stringify(r.address)}`);
  }

  if (!APPLY) {
    console.log('\nDry run only - no writes made. Re-run with --apply to write these addresses.');
    return;
  }

  console.log(`\nApplying ${toApply.length} address recoveries...`);
  for (const r of toApply) {
    await prisma.address.create({
      data: {
        ownerType: 'BORROWER',
        ownerId: r.borrowerId,
        houseUnitNumber: r.address.houseUnitNumber,
        street: r.address.street,
        barangay: r.address.barangay,
        cityMunicipality: r.address.cityMunicipality,
        zipCode: r.address.zipCode,
      },
    });
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
