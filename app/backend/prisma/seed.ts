import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds only stable reference data: one provisional Branch (ADR-005), the
 * minimum Role baseline (AUDIT-4), and a starter Permission set (AUDIT-3).
 *
 * Deliberately does NOT create a default admin user with a known password —
 * that is a security anti-pattern. The first administrator is created via a
 * guarded interactive bootstrap step in Milestone 6 (Authentication).
 */
async function main() {
  // ADR-005 (Critical/Blocking, resolved provisionally): no legacy branch
  // list exists. This seed creates exactly one placeholder branch. Adding
  // the real branch list later is a data change only — the schema does not
  // need to change.
  const headOffice = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: {},
    create: {
      code: 'HQ',
      name: 'Head Office (provisional — pending ADR-005)',
      isActive: true,
    },
  });

  // AUDIT-4: minimum role baseline from PROJECT_RULES.md §User Roles.
  const roleNames = [
    'Administrator',
    'Manager',
    'Loan Officer',
    'Cashier',
    'Collection Officer',
    'Viewer',
  ] as const;

  const roles: Record<string, { id: string }> = {};
  for (const name of roleNames) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // AUDIT-3: permissions are configurable, DB-driven records — never
  // hard-coded role-name checks in application code. This starter set
  // covers the modules built so far and is extended as new modules land;
  // it is not a claim of completeness for the eventual full RBAC design
  // (ADR-038, deferred).
  const permissionCodes = [
    'borrower:read',
    'borrower:write',
    'loan_product:read',
    'loan_product:write',
    'loan_account:read',
    'loan_account:approve',
    'loan_account:disburse',
    'loan_account:close',
    'repayment:post',
    'repayment:read',
    'user:manage',
    'audit_log:read',
  ];

  const permissions: Record<string, { id: string }> = {};
  for (const code of permissionCodes) {
    permissions[code] = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  // Administrator gets every seeded permission by default — a standard,
  // uncontroversial bootstrap convention, not a business-rule assumption.
  // Every other role's permission set is a genuine policy decision left to
  // Milestone 6 / an admin UI, per ADR-038.
  const adminRole = roles['Administrator'];
  for (const code of permissionCodes) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permissions[code].id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permissions[code].id,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Branch: ${headOffice.code}. Roles: ${roleNames.length}. Permissions: ${permissionCodes.length}.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
