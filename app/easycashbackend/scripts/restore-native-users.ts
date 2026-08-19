/**
 * 2026-08-19 (user request): restores whatever backup-native-users.ts saved right before the
 * reset, back into the freshly-migrated database - the same login (email + original password
 * hash) works immediately afterward, no need to re-run bootstrap-admin.ts or re-create every
 * account by hand. See that script's own doc comment for the full reasoning/scope.
 *
 * `branchCode`/`roleNames`/`roleClass` were denormalized (not raw ids) in the backup specifically
 * because Branch/Role/RoleClass all get brand-new ids on every fresh migration (seed.ts upserts
 * them by code/name into an empty table, which always takes the "create new row" path) - this
 * remaps each one back to whatever id it actually has post-migration:
 * - branchCode -> Branch.findUnique({ code }). Skips the user (does not guess a fallback branch)
 *   if that exact code doesn't exist anymore.
 * - roleNames -> Role.findMany({ name: { in } }), one UserRole row per match found; a role name
 *   that no longer exists (e.g. renamed) is silently dropped from that user rather than failing
 *   the whole restore - logged as a warning either way.
 * - roleClass -> looked up by (the remapped role's new id, className) - RoleClass is cosmetic-only
 *   (does not affect access, see its own schema doc comment), so a miss here just leaves it unset
 *   rather than blocking the account restore.
 *
 * Run this AFTER the fresh migration completes, alongside restore-native-loan-applications.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

interface BackedUpUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: string;
  contactNumber: string | null;
  address: string | null;
  birthday: string | null;
  twoFactorEnabled: boolean;
  twoFactorChannel: string | null;
  companyId: string | null;
  createdAt: string;
  branchCode: string;
  roleNames: string[];
  roleClass: { roleName: string; className: string } | null;
}

function findLatestBackup(): string | null {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('native-users-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(BACKUP_DIR, files[0]!) : null;
}

async function main() {
  const backupPath = findLatestBackup();
  if (!backupPath) {
    console.log('Walang nahanap na native-users backup - walang irerestore.');
    return;
  }
  console.log(`Gagamitin: ${backupPath}`);

  const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as { users: BackedUpUser[] };
  if (payload.users.length === 0) {
    console.log('Walang laman ang backup na ito - walang irerestore.');
    return;
  }

  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));

  let usersRestored = 0;
  let usersSkipped = 0;

  for (const backedUp of payload.users) {
    const branch = await prisma.branch.findUnique({ where: { code: backedUp.branchCode } });
    if (!branch) {
      console.warn(`  ! Nalaktawan ang user ${backedUp.email} - walang branch na may code "${backedUp.branchCode}" pagkatapos ng migration.`);
      usersSkipped++;
      continue;
    }

    let roleClassId: string | null = null;
    if (backedUp.roleClass) {
      const newRoleId = roleIdByName.get(backedUp.roleClass.roleName);
      if (newRoleId) {
        const roleClass = await prisma.roleClass.findUnique({
          where: { roleId_name: { roleId: newRoleId, name: backedUp.roleClass.className } },
        });
        roleClassId = roleClass?.id ?? null;
        if (!roleClass) {
          console.warn(`  ! "${backedUp.roleClass.className}" role class hindi nahanap para kay ${backedUp.email} - iiwang blangko.`);
        }
      }
    }

    try {
      await prisma.user.create({
        data: {
          id: backedUp.id,
          branchId: branch.id,
          email: backedUp.email,
          passwordHash: backedUp.passwordHash,
          firstName: backedUp.firstName,
          lastName: backedUp.lastName,
          status: backedUp.status as never,
          contactNumber: backedUp.contactNumber,
          address: backedUp.address,
          birthday: backedUp.birthday ? new Date(backedUp.birthday) : null,
          twoFactorEnabled: backedUp.twoFactorEnabled,
          twoFactorChannel: backedUp.twoFactorChannel,
          companyId: backedUp.companyId,
          createdAt: new Date(backedUp.createdAt),
          roleClassId,
        },
      });

      const matchedRoleIds = backedUp.roleNames.map((name) => roleIdByName.get(name)).filter((id): id is string => Boolean(id));
      const missingRoleNames = backedUp.roleNames.filter((name) => !roleIdByName.has(name));
      if (missingRoleNames.length > 0) {
        console.warn(`  ! "${missingRoleNames.join(', ')}" role(s) hindi nahanap para kay ${backedUp.email} - nalaktawan.`);
      }
      if (matchedRoleIds.length > 0) {
        await prisma.userRole.createMany({
          data: matchedRoleIds.map((roleId) => ({ userId: backedUp.id, roleId })),
        });
      }

      usersRestored++;
    } catch (error) {
      console.warn(`  ! Nalaktawan ang user ${backedUp.email} - ${(error as Error).message.split('\n')[0]}`);
      usersSkipped++;
    }
  }

  console.log('');
  console.log(`Na-restore: ${usersRestored}/${payload.users.length} user account(s).`);
  if (usersSkipped > 0) {
    console.log(`Nalaktawan: ${usersSkipped} account(s) - see mga warning sa itaas.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
