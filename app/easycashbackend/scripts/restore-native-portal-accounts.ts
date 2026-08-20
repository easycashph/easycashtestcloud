/**
 * 2026-08-20 (user request): restores whatever backup-native-portal-accounts.ts saved right before
 * the reset, back into the freshly-migrated database - so borrowers who signed up for Portal
 * self-service access don't lose their login after a full reset. See that script's own doc comment
 * for the full reasoning/scope.
 *
 * `borrowerLegacyId` is remapped to whatever `Borrower.id` actually has that `legacyId` post-
 * migration (NOT trusted as a stable raw id - see the backup script's own doc comment for why).
 * A portal account whose linked borrower no longer resolves (renamed/removed legacyId) restores
 * with `borrowerId: null` instead - the login itself is preserved either way, only the "linked to
 * this specific client record" association would be lost, and a staff member can always re-link it
 * via "Create Client Profile"/the existing linking flow.
 *
 * Run this AFTER the fresh migration completes, alongside restore-native-users.ts/
 * restore-native-role-permissions.ts/restore-native-loan-applications.ts/
 * restore-native-system-settings.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

interface BackedUpPortalAccount {
  id: string;
  email: string;
  passwordHash: string;
  contactNumber: string | null;
  status: string;
  emailVerifiedAt: string | null;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  twoFactorChannel: string | null;
  borrowerLegacyId: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  gender: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  civilStatus: string | null;
  homeOwnership: string | null;
  mobilePhone1: string | null;
  mobilePhone2: string | null;
  occupation: string | null;
  employer: string | null;
  monthlyIncome: string | null;
  officeAddress: string | null;
  tinNumber: string | null;
  sssNumber: string | null;
  dependants: unknown;
  reference1Name: string | null;
  reference1Mobile: string | null;
  reference2Name: string | null;
  reference2Mobile: string | null;
  houseUnitNumber: string | null;
  street: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  zipCode: string | null;
  createdAt: string;
}

function findLatestBackup(): string | null {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('native-portal-accounts-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(BACKUP_DIR, files[0]!) : null;
}

async function main() {
  const backupPath = findLatestBackup();
  if (!backupPath) {
    console.log('Walang nahanap na native-portal-accounts backup - walang irerestore.');
    return;
  }
  console.log(`Gagamitin: ${backupPath}`);

  const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as { accounts: BackedUpPortalAccount[] };
  if (payload.accounts.length === 0) {
    console.log('Walang laman ang backup na ito - walang irerestore.');
    return;
  }

  const borrowers = await prisma.borrower.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } });
  const borrowerIdByLegacyId = new Map(borrowers.map((b) => [b.legacyId as string, b.id]));

  let restored = 0;
  let skipped = 0;
  let borrowerLinkDropped = 0;

  for (const a of payload.accounts) {
    let borrowerId: string | null = null;
    if (a.borrowerLegacyId) {
      borrowerId = borrowerIdByLegacyId.get(a.borrowerLegacyId) ?? null;
      if (!borrowerId) {
        console.warn(`  ! ${a.email}: hindi na nahanap ang naka-link na borrower - iniwan na lang na hindi naka-link.`);
        borrowerLinkDropped++;
      }
    }

    try {
      await prisma.portalAccount.create({
        data: {
          id: a.id,
          email: a.email,
          passwordHash: a.passwordHash,
          contactNumber: a.contactNumber,
          status: a.status as never,
          emailVerifiedAt: a.emailVerifiedAt ? new Date(a.emailVerifiedAt) : null,
          mustChangePassword: a.mustChangePassword,
          twoFactorEnabled: a.twoFactorEnabled,
          twoFactorChannel: a.twoFactorChannel,
          borrowerId,
          firstName: a.firstName,
          middleName: a.middleName,
          lastName: a.lastName,
          suffix: a.suffix,
          gender: a.gender,
          birthDate: a.birthDate ? new Date(a.birthDate) : null,
          placeOfBirth: a.placeOfBirth,
          nationality: a.nationality,
          civilStatus: a.civilStatus,
          homeOwnership: a.homeOwnership,
          mobilePhone1: a.mobilePhone1,
          mobilePhone2: a.mobilePhone2,
          occupation: a.occupation,
          employer: a.employer,
          monthlyIncome: a.monthlyIncome,
          officeAddress: a.officeAddress,
          tinNumber: a.tinNumber,
          sssNumber: a.sssNumber,
          dependants: a.dependants as never,
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
          createdAt: new Date(a.createdAt),
        },
      });
      restored++;
    } catch (error) {
      console.warn(`  ! Nalaktawan ang portal account ${a.email} - ${(error as Error).message.split('\n')[0]}`);
      skipped++;
    }
  }

  console.log('');
  console.log(`Na-restore: ${restored}/${payload.accounts.length} portal account(s).`);
  if (borrowerLinkDropped > 0) {
    console.log(`  (${borrowerLinkDropped} sa mga ito ay na-restore nang walang borrower link - see mga warning sa itaas.)`);
  }
  if (skipped > 0) {
    console.log(`Nalaktawan: ${skipped} account(s) - see mga warning sa itaas.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
