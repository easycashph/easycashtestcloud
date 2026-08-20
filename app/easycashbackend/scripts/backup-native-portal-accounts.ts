/**
 * 2026-08-20 (user request, "suriin mo nga sa backup ang Portal Account before ng migration"):
 * extends the native-data safety net (loan applications §26, users §27, role permissions §32,
 * system settings §33) to `PortalAccount` - self-service borrower login accounts for the Easycash
 * Portal, completely separate from staff `User` accounts. A full `prisma migrate reset --force`
 * wipes this table with nothing in `seed.ts` to rebuild it - discovered the hard way: the live
 * 2026-08-20 database had 0 `PortalAccount` rows, while the pre-migration (2026-08-18) backup had
 * 7 (6 real, 1 the `TESTManny Mayweather Pacquiao` test account already deliberately deleted
 * earlier this session - excluded here by name/email, see the filter below).
 *
 * `borrowerId` is denormalized to the linked `Borrower.legacyId` (not the raw id) - a real,
 * separate discovery this same investigation surfaced: `Borrower.id` is NOT stable across a full
 * reset even for a legacy-sourced borrower (`migrate-legacy-data.ts`'s `borrower.upsert()` always
 * takes the `create` path against an empty table post-reset, which assigns a brand-new random
 * `@default(uuid())` id every time - only `legacyId` itself stays constant). This corrects an
 * assumption `backup-native-loan-applications.ts`/`restore-native-loan-applications.ts` got wrong
 * (their own doc comment claims legacy-derived rows "survive the reset with the SAME id" - they
 * don't; that restore's `borrowerId` links were silently null'd out rather than remapped - worth
 * fixing there too, flagged as a follow-up, not fixed in this script).
 *
 * A portal account with no `borrowerId` yet (not linked to a real client) is backed up with
 * `borrowerLegacyId: null` and restored the same way - most portal signups start unlinked.
 *
 * Run this BEFORE the reset, alongside the other backup-native-*.ts scripts. Pairs with
 * restore-native-portal-accounts.ts, run AFTER the fresh migration completes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

/** 2026-08-20 (user-confirmed, same session) - excluded by email: a known test account already
 * deliberately removed from every other table earlier this session (loan account, borrower, client
 * records) - restoring its portal login here would silently bring it back. */
const EXCLUDED_EMAILS = new Set(['101xsalt@gmail.com']);

async function main() {
  const accounts = await prisma.portalAccount.findMany({
    include: { borrower: { select: { legacyId: true } } },
  });
  const filtered = accounts.filter((a) => !EXCLUDED_EMAILS.has(a.email.toLowerCase()));

  if (filtered.length === 0) {
    console.log('Walang native portal account na nakita - walang kailangang i-backup.');
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(BACKUP_DIR, `native-portal-accounts-${timestamp}.json`);

  const payload = {
    createdAt: new Date().toISOString(),
    accounts: filtered.map((a) => ({
      id: a.id,
      email: a.email,
      passwordHash: a.passwordHash,
      contactNumber: a.contactNumber,
      status: a.status,
      emailVerifiedAt: a.emailVerifiedAt ? a.emailVerifiedAt.toISOString() : null,
      mustChangePassword: a.mustChangePassword,
      twoFactorEnabled: a.twoFactorEnabled,
      twoFactorChannel: a.twoFactorChannel,
      borrowerLegacyId: a.borrower?.legacyId ?? null,
      firstName: a.firstName,
      middleName: a.middleName,
      lastName: a.lastName,
      suffix: a.suffix,
      gender: a.gender,
      birthDate: a.birthDate ? a.birthDate.toISOString() : null,
      placeOfBirth: a.placeOfBirth,
      nationality: a.nationality,
      civilStatus: a.civilStatus,
      homeOwnership: a.homeOwnership,
      mobilePhone1: a.mobilePhone1,
      mobilePhone2: a.mobilePhone2,
      occupation: a.occupation,
      employer: a.employer,
      monthlyIncome: a.monthlyIncome ? a.monthlyIncome.toString() : null,
      officeAddress: a.officeAddress,
      tinNumber: a.tinNumber,
      sssNumber: a.sssNumber,
      dependants: a.dependants,
      reference1Name: a.reference1Name,
      reference1Mobile: a.reference1Mobile,
      reference2Name: a.reference2Name,
      reference2Mobile: a.reference2Mobile,
      houseUnitNumber: a.houseUnitNumber,
      street: a.street,
      barangay: a.barangay,
      cityMunicipality: a.cityMunicipality,
      province: a.province,
      zipCode: a.zipCode,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Na-backup: ${filtered.length} native portal account(s).`);
  console.log(`Saved to: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
