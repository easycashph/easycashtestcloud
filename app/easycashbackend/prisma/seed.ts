import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds only stable reference data: the single Branch (ADR-005), the
 * minimum Role baseline (AUDIT-4), and a starter Permission set (AUDIT-3).
 *
 * Deliberately does NOT create a default admin user with a known password —
 * that is a security anti-pattern. The first administrator is created via a
 * guarded interactive bootstrap step in Milestone 6 (Authentication).
 */
async function main() {
  // ADR-005 (Critical/Blocking, resolved 2026-08-04 - user-confirmed Easycash operates a single
  // branch, no further branch list to come): this seed creates exactly that one branch.
  // Address confirmed 2026-07-11 for the loan-application pre-qualification distance rule
  // (LoanApplicationPreQualificationService) — latitude/longitude are left null here and geocoded
  // lazily on first use, so seeding never makes a network call.
  const headOfficeAddress = 'Unit 9 G/F The Midland Plaza, M Adriatico, Barangay 669, Ermita, Manila';
  const headOffice = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: { address: headOfficeAddress },
    create: {
      code: 'HQ',
      name: 'Head Office',
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

  // AUDIT-3 / ADR-038 (2026-08-06, user-confirmed): permissions are configurable, DB-driven
  // records, checked at request time by `requirePermission` — replacing the interim
  // `requireRole` hard-coded allow-lists ADR-043 accepted for Milestone 8. Every code below and
  // its default per-role grants are a deliberate 1:1 mirror of the allow-lists each route already
  // enforced (see each router's own `_ROLES` constant, e.g. `PAYMENT_RECORDING_ROLES` in
  // `loanAccountRouter.ts`) — this migration changes NOTHING about who can do what on day one; it
  // only makes it configurable going forward via the new Roles & Permissions screen (MIS only).
  // The `document.generate`/`esignature.manage`/`collection.*`/`report.view` codes are new gates
  // on routes that previously had no role restriction at all (`requireAuth` only) — defaulted to
  // every role granted, matching that prior unrestricted reality, so MIS can now selectively
  // narrow them (the original ask: e.g. turning `document.generate` off for Collection Officer).
  const permissionDescriptions: Record<string, string> = {
    'loan_application.manage': 'Create, review, and pre-approve loan applications',
    'loan_application.final_approve': 'Give final approval or decline on a loan application',
    'loan_application.revert': 'Revert a loan application to an earlier stage',
    'loan_application.delete': 'Permanently delete a loan application',
    'loan_account.originate': 'Create a new loan account from an approved application',
    'loan_account.approve': 'Approve a loan account for disbursement',
    'loan_account.undo_approve': 'Undo a loan account approval',
    'loan_account.activate': 'Activate (disburse) an approved loan account',
    'loan_account.undo_activate': 'Undo a loan account activation',
    'loan_account.restructure': 'Restructure a loan account',
    'loan_account.undo_restructure': 'Undo a loan account restructure',
    'loan_account.adjust': 'Write off or adjust a loan account',
    'loan_account.undo_adjust': 'Undo a loan account adjustment',
    'payment.record': 'Record a borrower payment',
    'payment.reverse': 'Reverse a recorded payment',
    'payment.manual_adjust': 'Manually correct paid amounts on a legacy payment transaction with no per-installment breakdown',
    'penalty.reduce': 'Reduce or waive an installment penalty',
    'penalty.charge': 'Charge a new penalty on an installment',
    'fees.adjust': 'Adjust an installment fee amount',
    'fee.charge': 'Charge a new fee on an installment',
    'document.generate': 'Generate loan documents',
    // 2026-08-09 (Document Templates admin config, user request): separate, narrower, MIS-only-
    // by-default admin permission - configures the required/conditional rules `document.generate`
    // itself follows, not the act of generating a document for a loan.
    'document_template.manage': 'Manage document template required/conditional status and product mapping',
    'statement_of_account.generate': 'Generate a Statement of Account',
    'attachment.upload': 'Upload borrower/loan attachments',
    'esignature.manage': 'Send and manage e-signature requests',
    'borrower.write': 'Create or edit borrower profiles',
    'loan_product.write': 'Create or edit loan products',
    'ai_extraction.use': 'Use AI document extraction',
    'collection.view_past_due': 'View past due / overdue accounts',
    'collection.note.write': 'Add collection notes to a borrower or loan profile',
    // 2026-08-22 (user request): split the single blanket `report.view` into one code per report,
    // so MIS can grant/restrict access to individual reports instead of all-or-nothing. Covers the
    // 13 reports gated by reportingRouter.ts as of this change - Reminder Logs/E-signature Logs
    // are separate routers with no permission gate at all yet, deliberately out of scope here (see
    // this session's log for the follow-up note). `report.view` itself is removed below (a
    // one-off cleanup script deletes the now-superseded DB row/grants - see
    // scripts/remove-report-view-permission.ts, run once then deleted per this repo's convention).
    'report.loan_origination.view': 'View and download the Loan report',
    'report.collections.view': 'View and download the Collection report',
    'report.transactions.view': 'View and download the Transaction report',
    'report.loan_releases.view': 'View and download the Loan Releases report',
    'report.aging.view': 'View and download the Aging report',
    'report.ending_balance.view': 'View and download the Detailed Ending Current Balance report',
    'report.accounts_past_due.view': 'View and download the Accounts with Past Due report',
    'report.collection_history.view': 'View and download the Collection (history) report',
    'report.expected_collection.view': 'View and download the Expected Collection report',
    'report.first_amortization.view': 'View and download the First Amortization report',
    'report.daily_collection.view': 'View and download the Daily Collection report',
    'report.fully_paid.view': 'View and download the Fully Paid Accounts report',
    'report.portal_accounts.view': 'View and download the Portal Accounts report',
    'user.manage': 'Manage staff user accounts and roles',
    'audit_log.read': 'View the audit log',
    'reminder_settings.manage': 'Manage SMS/email reminder settings',
    'profile_activity_log.manage': 'View and manage profile activity logs',
    'system_announcement.manage': 'Post and manage system-wide announcements (maintenance/news popups)',
    'chat_canned_response.manage': 'Create, edit, and delete shared chat canned/quick responses',
    // 2026-08-24 (user request): the Exports hub (client attachments, loan attachments, database
    // dump) was hard-restricted to MIS via requireRole('MIS') - moved into the DB-backed permission
    // system instead so it's configurable from the Roles & Permissions screen. Not added to any
    // other role's default grant below, so behavior is unchanged today (MIS-only) until MIS
    // explicitly extends it.
    'bulk_export.use': 'Export borrower/loan attachments and database dumps in bulk',
  };
  const permissionCodes = Object.keys(permissionDescriptions);

  const permissions: Record<string, { id: string }> = {};
  for (const code of permissionCodes) {
    permissions[code] = await prisma.permission.upsert({
      where: { code },
      update: { description: permissionDescriptions[code] },
      create: { code, description: permissionDescriptions[code] },
    });
  }

  // 2026-08-22: every role that previously had the single `report.view` gets all 13 granular
  // report codes instead, preserving "sees every report" as the default - MIS can narrow
  // individual roles down from there via the Roles & Permissions screen.
  const ALL_REPORT_PERMISSIONS = [
    'report.loan_origination.view',
    'report.collections.view',
    'report.transactions.view',
    'report.loan_releases.view',
    'report.aging.view',
    'report.ending_balance.view',
    'report.accounts_past_due.view',
    'report.collection_history.view',
    'report.expected_collection.view',
    'report.first_amortization.view',
    'report.daily_collection.view',
    'report.fully_paid.view',
    'report.portal_accounts.view',
  ];

  // Default grants per role, mirroring each route's pre-existing `_ROLES` allow-list exactly (see
  // this block's own doc comment above for the full rationale).
  const defaultRolePermissions: Record<string, string[]> = {
    MIS: permissionCodes, // super-user role (ADR-038 §1/§3.2) - every permission.
    'Loan Operation Manager': [
      'loan_application.manage',
      'loan_application.final_approve',
      'loan_account.originate',
      'loan_account.approve',
      'loan_account.activate',
      'payment.record',
      'document.generate',
      'statement_of_account.generate',
      'attachment.upload',
      'esignature.manage',
      'borrower.write',
      'loan_product.write',
      'ai_extraction.use',
      'collection.view_past_due',
      'collection.note.write',
      ...ALL_REPORT_PERMISSIONS,
    ],
    CRM: [
      'loan_application.manage',
      'loan_account.originate',
      'document.generate',
      'statement_of_account.generate',
      'attachment.upload',
      'esignature.manage',
      'borrower.write',
      'ai_extraction.use',
      'collection.view_past_due',
      'collection.note.write',
      ...ALL_REPORT_PERMISSIONS,
    ],
    Finance: [
      'loan_product.write',
      'document.generate',
      'statement_of_account.generate',
      'esignature.manage',
      'collection.view_past_due',
      'collection.note.write',
      ...ALL_REPORT_PERMISSIONS,
    ],
    Accounting: [
      'loan_account.activate',
      'loan_account.restructure',
      'loan_account.adjust',
      'payment.record',
      'penalty.reduce',
      'penalty.charge',
      'fees.adjust',
      'fee.charge',
      'loan_product.write',
      'document.generate',
      'statement_of_account.generate',
      'esignature.manage',
      'collection.view_past_due',
      'collection.note.write',
      ...ALL_REPORT_PERMISSIONS,
    ],
    'Collection Officer': [
      'payment.record',
      'document.generate',
      'statement_of_account.generate',
      'esignature.manage',
      'collection.view_past_due',
      'collection.note.write',
      ...ALL_REPORT_PERMISSIONS,
    ],
  };
  for (const [roleName, codes] of Object.entries(defaultRolePermissions)) {
    const role = roles[roleName];
    for (const code of codes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissions[code].id } },
        update: {},
        create: { roleId: role.id, permissionId: permissions[code].id },
      });
    }
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

  // ADR-051 §1: the loan document types in scope (Statement of Account excluded — separate,
  // on-demand feature). Required documents apply to every loan and have no
  // DocumentTemplateMapping row; conditional documents are linked to specific Loan Products via
  // that table.
  // 2026-08-08 (user request): added QUIT_CLAIM as a conditional document - no product mapping
  // seeded yet, since which Loan Product(s) it should apply to hasn't been confirmed. Template
  // file at `templates/QUIT_CLAIM.docx` (renamed from the user-supplied
  // `QUIT_CLAIM_Redesigned_A4_One_Page.docx` to match this repo's "code == filename" convention).
  // 2026-08-09 (user request): moved ACKNOWLEDGEMENT_RECEIPT from required to conditional, mapped
  // to every existing Loan Product below (same net effect as before - every product still gets
  // it - but now removable per-product later without a code change).
  const documentTemplateRows = [
    { code: 'DISCLOSURE_STATEMENT', name: 'Disclosure Statement', isRequired: true, sortIndex: 1 },
    { code: 'PROMISSORY_NOTE', name: 'Promissory Note', isRequired: true, sortIndex: 2 },
    { code: 'DATA_PRIVACY_CONSENT', name: 'Data Privacy and Consent Form', isRequired: true, sortIndex: 3 },
    { code: 'LOAN_AGREEMENT_SALARY', name: 'Loan Agreement - Salary', isRequired: false, sortIndex: 4 },
    { code: 'LOAN_AGREEMENT_SEAFARER', name: 'Loan Agreement - Seafarer', isRequired: false, sortIndex: 5 },
    { code: 'DEED_OF_ASSIGNMENT_BORROWER', name: 'Deed of Assignment - Borrower', isRequired: false, sortIndex: 6 },
    { code: 'DEED_OF_ASSIGNMENT_CO_BORROWER', name: 'Deed of Assignment - Co-Borrower', isRequired: false, sortIndex: 7 },
    { code: 'DEED_OF_ASSIGNMENT_SALARY', name: 'Deed of Assignment - Salary', isRequired: false, sortIndex: 8 },
    { code: 'SPECIAL_POWER_OF_ATTORNEY', name: 'Special Power of Attorney', isRequired: false, sortIndex: 9 },
    { code: 'MANULIFE', name: 'Manulife', isRequired: false, sortIndex: 10 },
    { code: 'ACKNOWLEDGEMENT_RECEIPT', name: 'Acknowledgement Receipt', isRequired: false, sortIndex: 11 },
    { code: 'QUIT_CLAIM', name: 'Quit Claim', isRequired: false, sortIndex: 12 },
  ] as const;
  const documentTemplatesByCode = new Map<string, { id: string }>();
  for (const row of documentTemplateRows) {
    const template = await prisma.documentTemplate.upsert({
      where: { code: row.code },
      update: { name: row.name, isRequired: row.isRequired, sortIndex: row.sortIndex },
      create: row,
    });
    documentTemplatesByCode.set(row.code, template);
  }

  // 2026-08-09 (user request): Acknowledgement Receipt was just moved from required to
  // conditional (above) - map it to every existing Loan Product so nothing changes in practice
  // (every product still gets it), while making it independently removable per-product later.
  const acknowledgementReceiptTemplate = documentTemplatesByCode.get('ACKNOWLEDGEMENT_RECEIPT')!;
  const allLoanProducts = await prisma.loanProduct.findMany({ select: { id: true } });
  for (const product of allLoanProducts) {
    await prisma.documentTemplateMapping.upsert({
      where: { loanProductId_documentTemplateId: { loanProductId: product.id, documentTemplateId: acknowledgementReceiptTemplate.id } },
      update: {},
      create: { loanProductId: product.id, documentTemplateId: acknowledgementReceiptTemplate.id },
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

  // Product Type Labels (2026-07-20): renamable display labels for the Loan Products catalog's
  // Product Type groupings - `canonicalKey` must match `productTypeClassification.ts`'s
  // `PRODUCT_TYPE_DEFS[].type` exactly (the stable grouping key); `label` starts identical and is
  // the only field officers can rename from Administration > System > Product Types.
  const productTypeCanonicalKeys = [
    'Business Loan',
    'Purchase Financing Loan',
    'Salary Loan',
    'Seafarer Loan',
    'Small and Medium-sized Enterprises Loan',
  ];
  let productTypeLabelCount = 0;
  for (const canonicalKey of productTypeCanonicalKeys) {
    await prisma.productTypeLabel.upsert({
      where: { canonicalKey },
      update: {},
      create: { canonicalKey, label: canonicalKey },
    });
    productTypeLabelCount += 1;
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete. Branch: ${headOffice.code}. Roles: ${roleNames.length}. Permissions: ${permissionCodes.length}. Interest rate chart rows: ${interestRateChartRows.length}. Document templates: ${documentTemplateRows.length}. Role Classes: ${roleClassCount}. Product Type Labels: ${productTypeLabelCount}.`,
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
