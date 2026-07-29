/* eslint-disable no-console */
/**
 * One-time data fix: 2026-07-22 — the create form now auto-uppercases applicant name and the
 * free-text parts of address (house/unit number, street) as the officer types, matching the
 * printed loan application form convention (ECLC-LOFN01). This backfills existing applications
 * submitted before that change so they display consistently too.
 *
 * Only touches free-text fields: `applicantName`, `houseUnitNumber`, `street`,
 * `previousHouseUnitNumber`, `previousStreet`. Deliberately leaves `barangay`/`cityMunicipality`/
 * `province` alone — those come from the official PSGC reference list, not free typing, and
 * should keep their proper-case names. The flattened `address`/`previousAddress` display strings
 * are rebuilt from the (now-uppercased house/street + untouched barangay/city/province) parts,
 * same join logic as the frontend's `presentAddress`/`previousAddress` builders.
 *
 * Idempotent: a name/field already in all caps produces no diff, so re-running is always safe.
 *
 * Usage:
 *   npx tsx scripts/uppercase-loan-application-names-addresses.ts            # dry run
 *   npx tsx scripts/uppercase-loan-application-names-addresses.ts --apply    # writes to DATABASE_URL
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

function joinAddress(houseUnitNumber: string | null, street: string | null, barangay: string | null, cityMunicipality: string | null, province: string | null): string | null {
  const parts = [houseUnitNumber, street, barangay, cityMunicipality, province].map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(', ') : null;
}

async function main(): Promise<void> {
  const applications = await prisma.loanApplication.findMany({
    select: {
      id: true,
      applicantName: true,
      houseUnitNumber: true,
      street: true,
      barangay: true,
      cityMunicipality: true,
      province: true,
      address: true,
      previousAddressSameAsPresent: true,
      previousHouseUnitNumber: true,
      previousStreet: true,
      previousBarangay: true,
      previousCityMunicipality: true,
      previousProvince: true,
      previousAddress: true,
    },
  });

  const diffs: { id: string; field: string; before: string; after: string }[] = [];
  const updates: {
    id: string;
    applicantName?: string;
    houseUnitNumber?: string;
    street?: string;
    address?: string | null;
    previousHouseUnitNumber?: string;
    previousStreet?: string;
    previousAddress?: string | null;
  }[] = [];

  for (const app of applications) {
    const patch: (typeof updates)[number] = { id: app.id };
    let changed = false;

    const upperName = app.applicantName.toUpperCase();
    if (upperName !== app.applicantName) {
      diffs.push({ id: app.id, field: 'applicantName', before: app.applicantName, after: upperName });
      patch.applicantName = upperName;
      changed = true;
    }

    const upperHouse = app.houseUnitNumber?.toUpperCase();
    const upperStreet = app.street?.toUpperCase();
    if ((upperHouse && upperHouse !== app.houseUnitNumber) || (upperStreet && upperStreet !== app.street)) {
      if (upperHouse && upperHouse !== app.houseUnitNumber) {
        diffs.push({ id: app.id, field: 'houseUnitNumber', before: app.houseUnitNumber ?? '', after: upperHouse });
        patch.houseUnitNumber = upperHouse;
      }
      if (upperStreet && upperStreet !== app.street) {
        diffs.push({ id: app.id, field: 'street', before: app.street ?? '', after: upperStreet });
        patch.street = upperStreet;
      }
      patch.address = joinAddress(upperHouse ?? app.houseUnitNumber, upperStreet ?? app.street, app.barangay, app.cityMunicipality, app.province);
      changed = true;
    }

    if (!app.previousAddressSameAsPresent) {
      const upperPrevHouse = app.previousHouseUnitNumber?.toUpperCase();
      const upperPrevStreet = app.previousStreet?.toUpperCase();
      if ((upperPrevHouse && upperPrevHouse !== app.previousHouseUnitNumber) || (upperPrevStreet && upperPrevStreet !== app.previousStreet)) {
        if (upperPrevHouse && upperPrevHouse !== app.previousHouseUnitNumber) {
          diffs.push({ id: app.id, field: 'previousHouseUnitNumber', before: app.previousHouseUnitNumber ?? '', after: upperPrevHouse });
          patch.previousHouseUnitNumber = upperPrevHouse;
        }
        if (upperPrevStreet && upperPrevStreet !== app.previousStreet) {
          diffs.push({ id: app.id, field: 'previousStreet', before: app.previousStreet ?? '', after: upperPrevStreet });
          patch.previousStreet = upperPrevStreet;
        }
        patch.previousAddress = joinAddress(
          upperPrevHouse ?? app.previousHouseUnitNumber,
          upperPrevStreet ?? app.previousStreet,
          app.previousBarangay,
          app.previousCityMunicipality,
          app.previousProvince,
        );
        changed = true;
      }
    }

    if (changed) updates.push(patch);
  }

  console.log(`Found ${updates.length} application(s) with ${diffs.length} field(s) to change out of ${applications.length} total.`);
  for (const d of diffs) {
    console.log(`  [${d.id}] ${d.field}: "${d.before}" -> "${d.after}"`);
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write these changes.');
    return;
  }

  for (const u of updates) {
    const { id, ...fields } = u;
    await prisma.loanApplication.update({ where: { id }, data: fields });
  }
  console.log(`\nApplied ${updates.length} update(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
