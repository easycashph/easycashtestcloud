/**
 * 2026-08-20 (user request): restores whatever backup-native-role-permissions.ts saved right
 * before the reset, back into the freshly-migrated database - so a manual Roles & Permissions
 * customization (e.g. granting Accounting `payment.reverse`) survives a full reset instead of
 * silently reverting to seed.ts's own defaults. See that script's own doc comment for the full
 * reasoning/scope.
 *
 * `roleName`/`permissionCode` were denormalized (not raw ids) in the backup specifically because
 * Role/Permission both get brand-new ids on every fresh migration (seed.ts upserts them by
 * name/code into an empty table) - this remaps each pair back to whatever ids they actually have
 * post-migration. A role name or permission code that no longer exists (e.g. renamed/removed) is
 * skipped with a warning rather than failing the whole restore. Uses `ON CONFLICT DO NOTHING`
 * (via a plain `createMany({ skipDuplicates: true })`) since re-granting something seed.ts already
 * set is a harmless no-op - only grants seed.ts didn't recreate actually change anything, so this
 * is safe to run even if seed.ts's own defaults shifted since the backup was taken.
 *
 * Run this AFTER the fresh migration completes, alongside restore-native-users.ts/
 * restore-native-loan-applications.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

interface BackedUpGrant {
  roleName: string;
  permissionCode: string;
}

function findLatestBackup(): string | null {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('native-role-permissions-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(BACKUP_DIR, files[0]!) : null;
}

async function main() {
  const backupPath = findLatestBackup();
  if (!backupPath) {
    console.log('Walang nahanap na native-role-permissions backup - walang irerestore.');
    return;
  }
  console.log(`Gagamitin: ${backupPath}`);

  const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as { grants: BackedUpGrant[] };
  if (payload.grants.length === 0) {
    console.log('Walang laman ang backup na ito - walang irerestore.');
    return;
  }

  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
  const permissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  const rowsToInsert: { roleId: string; permissionId: string }[] = [];
  let skipped = 0;

  for (const grant of payload.grants) {
    const roleId = roleIdByName.get(grant.roleName);
    const permissionId = permissionIdByCode.get(grant.permissionCode);
    if (!roleId || !permissionId) {
      console.warn(
        `  ! Nalaktawan ang grant "${grant.roleName}" -> "${grant.permissionCode}" - ${!roleId ? 'role' : 'permission'} hindi nahanap pagkatapos ng migration.`,
      );
      skipped++;
      continue;
    }
    rowsToInsert.push({ roleId, permissionId });
  }

  const result = rowsToInsert.length > 0 ? await prisma.rolePermission.createMany({ data: rowsToInsert, skipDuplicates: true }) : { count: 0 };

  console.log('');
  console.log(`Na-restore: ${result.count} bagong role-permission grant(s) (${rowsToInsert.length - result.count} nasa DB na, na-skip nang tahimik).`);
  if (skipped > 0) {
    console.log(`Nalaktawan: ${skipped} grant(s) - see mga warning sa itaas.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
