/**
 * 2026-08-19 (user request): a full `prisma migrate reset --force` (see "Run Full Legacy
 * Migration (Office Server PC).bat") wipes every `User` row, including native/local staff
 * accounts (created via Settings > Members or bootstrap-admin.ts) - `User.legacyId` only covers
 * identity TRACEABILITY for historically-known SDevTech/Mambu users (ADR-039: credentials
 * themselves are never migrated even for those), not real login accounts, so nothing re-creates a
 * usable account for anyone afterward. Without this, every staff member would be locked out until
 * someone re-ran bootstrap-admin.ts and re-created every account by hand.
 *
 * Scope: only `legacyId IS NULL` users (real local accounts, including their real `passwordHash` -
 * restoring the hash is safe, the plaintext password is never stored or exposed) - a legacy-
 * traceability-only user has no working credentials to preserve anyway. Denormalizes branch code
 * and role/role-class NAMES (not raw ids) into the backup, since Branch/Role/RoleClass are all
 * reseeded with brand-new ids on every fresh migration (upserted by name/code, not by a stable id)
 * - see restore-native-users.ts for how those get remapped back.
 *
 * Run this BEFORE the reset, alongside backup-native-loan-applications.ts. Pairs with
 * restore-native-users.ts, run AFTER the fresh migration completes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

async function main() {
  const users = await prisma.user.findMany({
    where: { legacyId: null },
    include: {
      branch: { select: { code: true } },
      roles: { include: { role: { select: { name: true } } } },
      roleClass: { include: { role: { select: { name: true } } } },
    },
  });

  if (users.length === 0) {
    console.log('Walang native user na nakita - walang kailangang i-backup.');
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(BACKUP_DIR, `native-users-${timestamp}.json`);

  const payload = {
    createdAt: new Date().toISOString(),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      contactNumber: u.contactNumber,
      address: u.address,
      birthday: u.birthday ? u.birthday.toISOString() : null,
      twoFactorEnabled: u.twoFactorEnabled,
      twoFactorChannel: u.twoFactorChannel,
      companyId: u.companyId,
      createdAt: u.createdAt.toISOString(),
      branchCode: u.branch.code,
      roleNames: u.roles.map((ur) => ur.role.name),
      roleClass: u.roleClass ? { roleName: u.roleClass.role.name, className: u.roleClass.name } : null,
    })),
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Na-backup: ${users.length} native user account(s).`);
  console.log(`Saved to: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
