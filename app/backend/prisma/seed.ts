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

  // 2026-07-11 (Create Loan Account, Contractual Rate auto-fill): sourced directly from MIS
  // Nomer's own Excel LMS (legacy/reports/BETA 1.5.83 LMSv3.xlsm, sheet Rate_details) — real data,
  // not invented. One entry (Add-On 1.75%, Term 3) was "242" in the source, corrected to 2.42 with
  // the user's explicit confirmation (an isolated decimal-point typo, not a pattern found
  // elsewhere in the sheet).
  const interestRateChartRows: { addOnRatePercent: number; termMonths: number; contractualRatePercent: number }[] = [
    // Add-On 3%
    { addOnRatePercent: 3, termMonths: 1, contractualRatePercent: 3 },
    { addOnRatePercent: 3, termMonths: 2, contractualRatePercent: 3.98 },
    { addOnRatePercent: 3, termMonths: 3, contractualRatePercent: 4.43 },
    { addOnRatePercent: 3, termMonths: 4, contractualRatePercent: 4.7 },
    { addOnRatePercent: 3, termMonths: 5, contractualRatePercent: 4.85 },
    { addOnRatePercent: 3, termMonths: 6, contractualRatePercent: 4.95 },
    { addOnRatePercent: 3, termMonths: 7, contractualRatePercent: 5.01 },
    { addOnRatePercent: 3, termMonths: 8, contractualRatePercent: 5.05 },
    { addOnRatePercent: 3, termMonths: 9, contractualRatePercent: 5.07 },
    { addOnRatePercent: 3, termMonths: 10, contractualRatePercent: 5.08 },
    { addOnRatePercent: 3, termMonths: 11, contractualRatePercent: 5.08 },
    { addOnRatePercent: 3, termMonths: 12, contractualRatePercent: 5.08 },
    // Add-On 3.5%
    { addOnRatePercent: 3.5, termMonths: 1, contractualRatePercent: 3.5 },
    { addOnRatePercent: 3.5, termMonths: 2, contractualRatePercent: 4.63 },
    { addOnRatePercent: 3.5, termMonths: 3, contractualRatePercent: 5.17 },
    { addOnRatePercent: 3.5, termMonths: 4, contractualRatePercent: 5.45 },
    { addOnRatePercent: 3.5, termMonths: 5, contractualRatePercent: 5.63 },
    { addOnRatePercent: 3.5, termMonths: 6, contractualRatePercent: 5.73 },
    { addOnRatePercent: 3.5, termMonths: 7, contractualRatePercent: 5.8 },
    { addOnRatePercent: 3.5, termMonths: 8, contractualRatePercent: 5.83 },
    { addOnRatePercent: 3.5, termMonths: 9, contractualRatePercent: 5.86 },
    { addOnRatePercent: 3.5, termMonths: 10, contractualRatePercent: 5.86 },
    { addOnRatePercent: 3.5, termMonths: 11, contractualRatePercent: 5.86 },
    { addOnRatePercent: 3.5, termMonths: 12, contractualRatePercent: 5.86 },
    // Add-On 1.5%
    { addOnRatePercent: 1.5, termMonths: 1, contractualRatePercent: 1.5 },
    { addOnRatePercent: 1.5, termMonths: 2, contractualRatePercent: 2 },
    { addOnRatePercent: 1.5, termMonths: 3, contractualRatePercent: 2.24 },
    { addOnRatePercent: 1.5, termMonths: 4, contractualRatePercent: 2.37 },
    { addOnRatePercent: 1.5, termMonths: 5, contractualRatePercent: 2.46 },
    { addOnRatePercent: 1.5, termMonths: 6, contractualRatePercent: 2.52 },
    { addOnRatePercent: 1.5, termMonths: 7, contractualRatePercent: 2.56 },
    { addOnRatePercent: 1.5, termMonths: 8, contractualRatePercent: 2.59 },
    { addOnRatePercent: 1.5, termMonths: 9, contractualRatePercent: 2.61 },
    { addOnRatePercent: 1.5, termMonths: 10, contractualRatePercent: 2.63 },
    { addOnRatePercent: 1.5, termMonths: 11, contractualRatePercent: 2.63 },
    { addOnRatePercent: 1.5, termMonths: 12, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 13, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 14, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 15, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 16, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 17, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 18, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 19, contractualRatePercent: 2.65 },
    { addOnRatePercent: 1.5, termMonths: 20, contractualRatePercent: 2.64 },
    { addOnRatePercent: 1.5, termMonths: 21, contractualRatePercent: 2.64 },
    { addOnRatePercent: 1.5, termMonths: 22, contractualRatePercent: 2.63 },
    { addOnRatePercent: 1.5, termMonths: 23, contractualRatePercent: 2.63 },
    { addOnRatePercent: 1.5, termMonths: 24, contractualRatePercent: 2.62 },
    // Add-On 2.25%
    { addOnRatePercent: 2.25, termMonths: 1, contractualRatePercent: 2.25 },
    { addOnRatePercent: 2.25, termMonths: 2, contractualRatePercent: 2.99 },
    { addOnRatePercent: 2.25, termMonths: 3, contractualRatePercent: 3.34 },
    { addOnRatePercent: 2.25, termMonths: 4, contractualRatePercent: 3.54 },
    { addOnRatePercent: 2.25, termMonths: 5, contractualRatePercent: 3.67 },
    { addOnRatePercent: 2.25, termMonths: 6, contractualRatePercent: 3.75 },
    { addOnRatePercent: 2.25, termMonths: 7, contractualRatePercent: 3.8 },
    { addOnRatePercent: 2.25, termMonths: 8, contractualRatePercent: 3.84 },
    { addOnRatePercent: 2.25, termMonths: 9, contractualRatePercent: 3.86 },
    { addOnRatePercent: 2.25, termMonths: 10, contractualRatePercent: 3.87 },
    { addOnRatePercent: 2.25, termMonths: 11, contractualRatePercent: 3.88 },
    { addOnRatePercent: 2.25, termMonths: 12, contractualRatePercent: 3.89 },
    // Add-On 2.75%
    { addOnRatePercent: 2.75, termMonths: 1, contractualRatePercent: 2.75 },
    { addOnRatePercent: 2.75, termMonths: 2, contractualRatePercent: 3.65 },
    { addOnRatePercent: 2.75, termMonths: 3, contractualRatePercent: 4.07 },
    { addOnRatePercent: 2.75, termMonths: 4, contractualRatePercent: 4.31 },
    { addOnRatePercent: 2.75, termMonths: 5, contractualRatePercent: 4.46 },
    { addOnRatePercent: 2.75, termMonths: 6, contractualRatePercent: 4.55 },
    { addOnRatePercent: 2.75, termMonths: 7, contractualRatePercent: 4.6 },
    { addOnRatePercent: 2.75, termMonths: 8, contractualRatePercent: 4.65 },
    { addOnRatePercent: 2.75, termMonths: 9, contractualRatePercent: 4.67 },
    { addOnRatePercent: 2.75, termMonths: 10, contractualRatePercent: 4.68 },
    { addOnRatePercent: 2.75, termMonths: 11, contractualRatePercent: 4.69 },
    { addOnRatePercent: 2.75, termMonths: 12, contractualRatePercent: 4.69 },
    // Add-On 2%
    { addOnRatePercent: 2, termMonths: 1, contractualRatePercent: 2 },
    { addOnRatePercent: 2, termMonths: 2, contractualRatePercent: 2.65 },
    { addOnRatePercent: 2, termMonths: 3, contractualRatePercent: 2.97 },
    { addOnRatePercent: 2, termMonths: 4, contractualRatePercent: 3.15 },
    { addOnRatePercent: 2, termMonths: 5, contractualRatePercent: 3.27 },
    { addOnRatePercent: 2, termMonths: 6, contractualRatePercent: 3.33 },
    { addOnRatePercent: 2, termMonths: 7, contractualRatePercent: 3.38 },
    { addOnRatePercent: 2, termMonths: 8, contractualRatePercent: 3.42 },
    { addOnRatePercent: 2, termMonths: 9, contractualRatePercent: 3.44 },
    { addOnRatePercent: 2, termMonths: 10, contractualRatePercent: 3.46 },
    { addOnRatePercent: 2, termMonths: 11, contractualRatePercent: 3.47 },
    { addOnRatePercent: 2, termMonths: 12, contractualRatePercent: 3.47 },
    // Add-On 2.5%
    { addOnRatePercent: 2.5, termMonths: 1, contractualRatePercent: 2.5 },
    { addOnRatePercent: 2.5, termMonths: 2, contractualRatePercent: 3.32 },
    { addOnRatePercent: 2.5, termMonths: 3, contractualRatePercent: 3.7 },
    { addOnRatePercent: 2.5, termMonths: 4, contractualRatePercent: 3.92 },
    { addOnRatePercent: 2.5, termMonths: 5, contractualRatePercent: 4.06 },
    { addOnRatePercent: 2.5, termMonths: 6, contractualRatePercent: 4.15 },
    { addOnRatePercent: 2.5, termMonths: 7, contractualRatePercent: 4.2 },
    { addOnRatePercent: 2.5, termMonths: 8, contractualRatePercent: 4.24 },
    { addOnRatePercent: 2.5, termMonths: 9, contractualRatePercent: 4.27 },
    { addOnRatePercent: 2.5, termMonths: 10, contractualRatePercent: 4.27 },
    { addOnRatePercent: 2.5, termMonths: 11, contractualRatePercent: 4.28 },
    { addOnRatePercent: 2.5, termMonths: 12, contractualRatePercent: 4.28 },
    { addOnRatePercent: 2.5, termMonths: 13, contractualRatePercent: 4.29 },
    { addOnRatePercent: 2.5, termMonths: 14, contractualRatePercent: 4.28 },
    { addOnRatePercent: 2.5, termMonths: 15, contractualRatePercent: 4.28 },
    { addOnRatePercent: 2.5, termMonths: 16, contractualRatePercent: 4.27 },
    { addOnRatePercent: 2.5, termMonths: 17, contractualRatePercent: 4.26 },
    { addOnRatePercent: 2.5, termMonths: 18, contractualRatePercent: 4.24 },
    { addOnRatePercent: 2.5, termMonths: 19, contractualRatePercent: 4.23 },
    { addOnRatePercent: 2.5, termMonths: 20, contractualRatePercent: 4.22 },
    { addOnRatePercent: 2.5, termMonths: 21, contractualRatePercent: 4.21 },
    { addOnRatePercent: 2.5, termMonths: 22, contractualRatePercent: 4.19 },
    { addOnRatePercent: 2.5, termMonths: 23, contractualRatePercent: 4.18 },
    { addOnRatePercent: 2.5, termMonths: 24, contractualRatePercent: 4.16 },
    // Add-On 10%
    { addOnRatePercent: 10, termMonths: 1, contractualRatePercent: 10 },
    { addOnRatePercent: 10, termMonths: 2, contractualRatePercent: 13.07 },
    { addOnRatePercent: 10, termMonths: 3, contractualRatePercent: 14.36 },
    // Add-On 5%
    { addOnRatePercent: 5, termMonths: 1, contractualRatePercent: 5 },
    { addOnRatePercent: 5, termMonths: 2, contractualRatePercent: 6.6 },
    { addOnRatePercent: 5, termMonths: 3, contractualRatePercent: 7.33 },
    { addOnRatePercent: 5, termMonths: 4, contractualRatePercent: 7.72 },
    // Add-On 1.75%
    { addOnRatePercent: 1.75, termMonths: 1, contractualRatePercent: 4.16 },
    { addOnRatePercent: 1.75, termMonths: 2, contractualRatePercent: 2.39 },
    { addOnRatePercent: 1.75, termMonths: 3, contractualRatePercent: 2.42 }, // corrected from source "242" — confirmed with user 2026-07-11
    { addOnRatePercent: 1.75, termMonths: 4, contractualRatePercent: 2.77 },
    { addOnRatePercent: 1.75, termMonths: 5, contractualRatePercent: 2.87 },
    { addOnRatePercent: 1.75, termMonths: 6, contractualRatePercent: 2.93 },
    { addOnRatePercent: 1.75, termMonths: 7, contractualRatePercent: 2.98 },
    { addOnRatePercent: 1.75, termMonths: 8, contractualRatePercent: 3 },
    { addOnRatePercent: 1.75, termMonths: 9, contractualRatePercent: 3.03 },
    { addOnRatePercent: 1.75, termMonths: 10, contractualRatePercent: 3.05 },
    { addOnRatePercent: 1.75, termMonths: 11, contractualRatePercent: 3.06 },
    { addOnRatePercent: 1.75, termMonths: 12, contractualRatePercent: 3.07 },
    { addOnRatePercent: 1.75, termMonths: 13, contractualRatePercent: 3.07 },
    { addOnRatePercent: 1.75, termMonths: 14, contractualRatePercent: 3.07 },
    { addOnRatePercent: 1.75, termMonths: 15, contractualRatePercent: 3.06 },
    { addOnRatePercent: 1.75, termMonths: 16, contractualRatePercent: 3.07 },
    { addOnRatePercent: 1.75, termMonths: 17, contractualRatePercent: 3.06 },
    { addOnRatePercent: 1.75, termMonths: 18, contractualRatePercent: 3.05 },
    { addOnRatePercent: 1.75, termMonths: 19, contractualRatePercent: 3.05 },
    { addOnRatePercent: 1.75, termMonths: 20, contractualRatePercent: 3.05 },
    { addOnRatePercent: 1.75, termMonths: 21, contractualRatePercent: 3.04 },
    { addOnRatePercent: 1.75, termMonths: 22, contractualRatePercent: 3.05 },
    { addOnRatePercent: 1.75, termMonths: 23, contractualRatePercent: 3.03 },
    { addOnRatePercent: 1.75, termMonths: 24, contractualRatePercent: 3.02 },
  ];
  for (const row of interestRateChartRows) {
    await prisma.interestRateChart.upsert({
      where: { addOnRatePercent_termMonths: { addOnRatePercent: row.addOnRatePercent, termMonths: row.termMonths } },
      update: { contractualRatePercent: row.contractualRatePercent },
      create: row,
    });
  }

  // ADR-051 §1: the 11 loan document types in scope (Statement of Account excluded — separate,
  // on-demand feature). Required documents apply to every loan and have no
  // DocumentTemplateMapping row; conditional documents are linked to specific Loan Products
  // separately (ADR-051 §9 — not yet confirmed with the user, so no mapping rows seeded here).
  const documentTemplateRows = [
    { code: 'DISCLOSURE_STATEMENT', name: 'Disclosure Statement', isRequired: true, sortIndex: 1 },
    { code: 'PROMISSORY_NOTE', name: 'Promissory Note', isRequired: true, sortIndex: 2 },
    { code: 'ACKNOWLEDGEMENT_RECEIPT', name: 'Acknowledgement Receipt', isRequired: true, sortIndex: 3 },
    { code: 'DATA_PRIVACY_CONSENT', name: 'Data Privacy and Consent Form', isRequired: true, sortIndex: 4 },
    { code: 'LOAN_AGREEMENT_SALARY', name: 'Loan Agreement - Salary', isRequired: false, sortIndex: 5 },
    { code: 'LOAN_AGREEMENT_SEAFARER', name: 'Loan Agreement - Seafarer', isRequired: false, sortIndex: 6 },
    { code: 'DEED_OF_ASSIGNMENT_BORROWER', name: 'Deed of Assignment - Borrower', isRequired: false, sortIndex: 7 },
    { code: 'DEED_OF_ASSIGNMENT_CO_BORROWER', name: 'Deed of Assignment - Co-Borrower', isRequired: false, sortIndex: 8 },
    { code: 'DEED_OF_ASSIGNMENT_SALARY', name: 'Deed of Assignment - Salary', isRequired: false, sortIndex: 9 },
    { code: 'SPECIAL_POWER_OF_ATTORNEY', name: 'Special Power of Attorney', isRequired: false, sortIndex: 10 },
    { code: 'MANULIFE', name: 'Manulife', isRequired: false, sortIndex: 11 },
  ] as const;
  for (const row of documentTemplateRows) {
    await prisma.documentTemplate.upsert({
      where: { code: row.code },
      update: { name: row.name, isRequired: row.isRequired, sortIndex: row.sortIndex },
      create: row,
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
    `Seed complete. Branch: ${headOffice.code}. Roles: ${roleNames.length}. Permissions: ${permissionCodes.length}. Interest rate chart rows: ${interestRateChartRows.length}. Document templates: ${documentTemplateRows.length}. Role Classes: ${roleClassCount}.`,
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
