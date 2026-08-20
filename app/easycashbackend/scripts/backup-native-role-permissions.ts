/**
 * 2026-08-20 (user request, prompted by §31 of the session log - see
 * docs/session-logs/SESSION_LOG_2026-08-14_office_server_move_and_manual_payment_adjustment.md):
 * a full `prisma migrate reset --force` wipes `role_permissions` along with everything else, and
 * `seed.ts` only recreates its own hardcoded DEFAULT grants afterward - any customization made
 * through the live Roles & Permissions settings page (`RolesPermissionsTab.tsx` /
 * `UpdateRolePermissionsUseCase`) since then has no other record and is silently lost. This was
 * discovered the hard way after the 2026-08-19/20 migration: 6 real grants
 * (Accounting: attachment.upload/payment.reverse; Collection Officer: attachment.upload; Loan
 * Operation Manager: loan_account.adjust/loan_account.restructure/loan_application.revert) only
 * got recovered because a same-day pg_dump happened to still exist - this script exists so that
 * doesn't have to be relied on again.
 *
 * Backs up the FULL current role_permissions table (not a diff against seed.ts defaults) -
 * denormalized to (role name, permission code) pairs, since Role/Permission both get brand-new ids
 * on every fresh migration (seed.ts upserts them by name/code into an empty table). Restoring the
 * full set back is safe and idempotent either way: restore-native-role-permissions.ts uses
 * `ON CONFLICT DO NOTHING`, so re-granting something seed.ts already set is a harmless no-op - only
 * grants seed.ts didn't recreate actually change anything.
 *
 * Run this BEFORE the reset, alongside backup-native-loan-applications.ts/backup-native-users.ts.
 * Pairs with restore-native-role-permissions.ts, run AFTER the fresh migration completes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

async function main() {
  const grants = await prisma.rolePermission.findMany({
    include: { role: { select: { name: true } }, permission: { select: { code: true } } },
  });

  if (grants.length === 0) {
    console.log('Walang role-permission grant na nakita - walang kailangang i-backup.');
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(BACKUP_DIR, `native-role-permissions-${timestamp}.json`);

  const payload = {
    createdAt: new Date().toISOString(),
    grants: grants.map((g) => ({ roleName: g.role.name, permissionCode: g.permission.code })),
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Na-backup: ${grants.length} role-permission grant(s).`);
  console.log(`Saved to: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
