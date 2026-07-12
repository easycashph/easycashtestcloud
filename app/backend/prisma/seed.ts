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
  // Address confirmed 2026-07-11 for the loan-application pre-qualification distance rule
  // (LoanApplicationPreQualificationService) — latitude/longitude are left null here and geocoded
  // lazily on first use, so seeding never makes a network call.
  const headOfficeAddress = 'Unit 9 G/F The Midland Plaza, M Adriatico, Barangay 669, Ermita, Manila';
  const headOffice = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: { address: headOfficeAddress },
    create: {
      code: 'HQ',
      name: 'Head Office (provisional — pending ADR-005)',
      isActive: true,
      address: headOfficeAddress,
    },
  });

  // AUDIT-4: minimum role baseline from PROJECT_RULES.md §User Roles.
  // Renamed 2026-07-06 per ADR-038 §1/§4 (business-confirmed roster,
  // replacing the old placeholder names Administrator/Manager/Loan
  // Officer/Cashier/Collection Officer/Viewer).
  const roleNames = [
    'MIS',
    'Loan Operation Manager',
    'CRM',
    'Finance',
    'Accounting',
    'Collection Officer',
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

  // MIS (the confirmed super-user role, ADR-038 §1/§3.2) gets every seeded
  // permission by default — a standard, uncontroversial bootstrap
  // convention, not a business-rule assumption. Every other role's
  // permission set is a genuine policy decision — see ADR-038 §3 for the
  // confirmed per-endpoint mapping; these `RolePermission` rows remain
  // unused by application code either way (ADR-038 §2).
  const misRole = roles['MIS'];
  for (const code of permissionCodes) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: misRole.id,
          permissionId: permissions[code].id,
        },
      },
      update: {},
      create: {
        roleId: misRole.id,
        permissionId: permissions[code].id,
      },
    });
  }

  // Role Class: organizational job-title labels under a Role (Administration > Member Details >
  // Roles tab) - display/organizational only, does not affect access. Business-confirmed roster.
  const roleClassesByRoleName: Record<string, string[]> = {
    MIS: ['MIS Manager', 'MIS Assistant'],
    'Loan Operation Manager': ['LOM'],
    CRM: ['CRM'],
    Accounting: ['Accounting'],
    Finance: ['Finance'],
    'Collection Officer': ['Collection Manager', 'Accounts Recovery Officer', 'Field Collector'],
  };
  let roleClassCount = 0;
  for (const [roleName, classNames] of Object.entries(roleClassesByRoleName)) {
    const role = roles[roleName];
    if (!role) continue;
    for (const className of classNames) {
      await prisma.roleClass.upsert({
        where: { roleId_name: { roleId: role.id, name: className } },
        update: {},
        create: { roleId: role.id, name: className },
      });
      roleClassCount += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete. Branch: ${headOffice.code}. Roles: ${roleNames.length}. Permissions: ${permissionCodes.length}. Role Classes: ${roleClassCount}.`,
  );
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
