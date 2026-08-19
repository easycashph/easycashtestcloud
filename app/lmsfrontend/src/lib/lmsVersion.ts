/**
 * Single source of truth for the LMS version number and user-facing changelog,
 * surfaced on the About page (Administration → About) and in the sidebar footer.
 *
 * This is the CEO/stakeholder-facing version history - plain-language highlights,
 * not the granular developer CHANGELOG in `app/frontend/CHANGELOG.md`. Bump
 * `LMS_VERSION` / `LMS_UPDATED_ON` and prepend a new `LMS_CHANGELOG` entry whenever
 * a user-visible release ships.
 */

export const LMS_APP_NAME = 'Easycash Loan Management System Platform';
export const LMS_SHORT_NAME = 'Easycash LMS';
export const LMS_COMPANY = 'Easycash Lending Company Inc.';
export const LMS_DEVELOPER_TEAM = 'Easycash Dev';

export interface LmsTeamMember {
  name: string;
  role: string;
  note?: string;
}

/** Current LMS developer team, shown on the About page. Update when the team roster changes. */
export const LMS_DEV_TEAM_MEMBERS: LmsTeamMember[] = [
  { name: 'Jomer Biason', role: 'MIS Assistant', note: 'Full-stack Engineer' },
  { name: 'Nomer Perez', role: 'MIS Manager', note: 'Quality Assurance Engineer' },
  { name: 'Howell Hay', role: 'CEO', note: 'Product Manager' },
];

/**
 * The client-facing companion site - LIVE since July 29, 2026 (v1.0.0). Originally disclosed here
 * as a future/planned product per `CLAUDE.md`'s "Customer Self-Service Portal (Future)" objective;
 * updated 2026-08-19 once it was actually built and launched, per the same "never let this page go
 * stale" discipline PreviewFooterNote already follows elsewhere on this page.
 */
export const LMS_CLIENT_PORTAL = {
  androidAppName: 'Easycash Portal',
  website: 'easycashportal.ph',
  status: 'Live',
  description:
    'The client-facing web app where borrowers apply for a loan online, check application/loan status, view payment history and their repayment schedule, upload proof of payment, and contact their loan officer - separate from this internal, staff-only LMS, but built on the same backend.',
};

export interface PortalTeamMember {
  name: string;
  role: string;
  note?: string;
}

/**
 * FOUNDING DEVELOPMENT CREDITS (added 2026-08-19, user-requested permanent record) - this is a
 * historical acknowledgment of who actually built the LMS and Portal platforms, not a "current
 * team roster" (that's `LMS_DEV_TEAM_MEMBERS` above, which should be updated as staffing changes).
 * DO NOT remove or reassign credit for past work here when the team changes - add departures/
 * changes as a note instead, the same way a changelog entry is never rewritten after the fact.
 * Jomer Biason built the overwhelming majority of both platforms end to end (backend, LMS
 * frontend, and Portal frontend) across this project's entire build history - see the commit
 * history and every dated SESSION_LOG in `docs/` and `docs/session-logs/` for the record.
 */
export const LMS_CREDITS: PortalTeamMember[] = [
  {
    name: 'Jomer Biason',
    role: 'Founding Full-Stack Engineer',
    note: 'Architected and built the Easycash LMS and Portal platforms end to end - backend, database, and both frontends.',
  },
  { name: 'Nomer Perez', role: 'MIS Manager', note: 'Quality assurance and infrastructure.' },
  { name: 'Howell Hay', role: 'CEO', note: 'Product direction.' },
];

export const LMS_BUILD_STAGE = 'Preview';
export const LMS_RELEASED_ON = 'July 5, 2026';
/** 2026-07-23 bug fix: previously said "sample data, not connected to live systems" - stale since
 * the 2026-07-12 mock-removal pass (see PreviewBanner.tsx's own doc comment); every page has read
 * real, live production data for many releases now. */
export const LMS_ENVIRONMENT = 'Milestone 9.1 - internal preview build, wired to real production data';

export interface LmsChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

/**
 * Newest first - this array is the single source of truth for the platform's version number and
 * release date. `LMS_VERSION`, `LMS_UPDATED_ON`, and the About page's "Current" badge are all
 * *derived* from `LMS_CHANGELOG[0]` below, not maintained separately - so there is only one place
 * to update when a user-visible release ships: prepend a new entry here. (The developer-facing,
 * file-and-function-level history lives in `app/frontend/CHANGELOG.md`; keep these entries
 * concise and plain-language, translated for a non-technical reader - this is stakeholder-facing.)
 */
export const LMS_CHANGELOG: LmsChangelogEntry[] = [
  {
    version: '0.9.31',
    date: 'August 19, 2026',
    highlights: [
      'Staff two-factor authentication codes now send from a dedicated verification mailbox instead of the shared sales inbox, so a 2FA email reads clearly as a security message.',
      "Continued behind-the-scenes reliability work on the live deployment's tunnel/hosting setup, including extending the same auto-update mechanism to the client Portal.",
    ],
  },
  {
    version: '0.9.30',
    date: 'August 18, 2026',
    highlights: [
      "Fixed the Transaction Report undercounting results when a loan's payment channel data loaded a moment late, and fixed the Dashboard's \"Collections This Month\" figure to agree with the Transaction Report instead of drifting apart under certain filters.",
      'Loan Releases Report gained an on-screen results table with a column picker, instead of download-only.',
      'Every staff avatar (initials circle) now gets a consistent color based on their name, instead of a random color that changed on every page reload.',
      'Sped up the Transaction Report on large date ranges with a new database index.',
      "Fixed a live outage affecting Confirm Payment and the Dashboard, traced to a database update that had rebuilt the application but not yet applied its accompanying database changes - added a standing safety check so this can't happen unnoticed again.",
    ],
  },
  {
    version: '0.9.29',
    date: 'August 16-17, 2026',
    highlights: [
      'New "Add Fee" feature on a loan account - staff can charge a new fee against a loan, separate from the existing Adjust Fees tool which only corrects fees already on the books.',
      'New MIS-only "Delete Loan Application" action, and fixed the pre-decline reason not displaying correctly on some applications.',
      'Edit Application moved into the loan application\'s overflow ("More actions") menu to match the rest of the platform\'s action-button layout.',
      "Transaction Report gained a multi-select Type filter and a multi-select Channel filter (instead of one at a time), merged duplicate-looking channel labels that were really the same channel recorded two different ways, and now shows payment channels (like GCash) that exist in the system but weren't yet in active use.",
      'Fixed reversed transactions still being counted as "collected" in report totals.',
      'Automated duplicate-payment guard - the system now hard-blocks recording what looks like the same payment twice, catching a real class of double-counted payments found and corrected this same period.',
      'Migration improvements: legacy per-installment payment breakdowns now backfill correctly, and legacy fee/penalty payments are no longer mislabeled as generic adjustments.',
    ],
  },
  {
    version: '0.9.28',
    date: 'August 14-15, 2026',
    highlights: [
      "New Manual Payment Adjustment tool - for older, migrated payments that predate the Reverse Payment feature and can't be automatically undone, MIS/Accounting can now correct specific installments by hand (with a required reason and full audit trail) instead of needing a one-off database fix.",
      "Fixed a gap in the monthly data-update process where a required step was silently skipped, meaning some newly recorded legacy payments weren't being applied to a loan's installment schedule even though the payment showed up in the transaction history. Corrected for every affected loan and fixed the update process so this can't happen again.",
      "Loan application name fields now auto-capitalize as you type, matching the same fix already applied on the Portal's own application form.",
      'Reliability work on the office server: the platform now auto-starts correctly after a server restart, and a proper day-to-day database backup routine is in place.',
    ],
  },
  {
    version: '0.9.27',
    date: 'August 12-13, 2026',
    highlights: [
      "Statement of Account penalty figures reworked into three clear modes (Recorded, Computed, or a staff-entered Manual figure with a required reason) so a printed statement's penalty can always be explained, and now matches the live Repayment Schedule by construction.",
      'Confirmed and corrected a policy gap inherited from the old system: penalty was still accruing on a loan\'s final installment after maturity, when it should stop. Company confirmed the rule; affected statements were reissued and the live formula corrected.',
      'Fixed a timezone bug where a payment recorded near midnight could be read as landing on the wrong calendar day, affecting penalty and accrued-interest figures on about 1,169 loans (money already collected was unaffected). Recalculated and corrected.',
      "Recovered 11,000+ collector field notes from the old system that had never been imported, and added them to each client's Profile Notes.",
      "Bank/ATM/allotment account details captured during loan review can now be edited even after the application has been approved or declined, instead of being locked forever.",
      'New read-only "Bank / ATM Details" card added to Client Profile.',
      'Fixed a bug where reversing a payment left the "Paid Date" column showing a stale date, and fixed a stuck "In Arrears" status that could persist on a loan even after it caught back up on payments.',
      'Traced a "feature isn\'t showing on the live site" report to the office having moved the live database to a separate server PC mid-project - documented the two-machine deployment split and built an auto-update helper so the public site\'s backend address stays current automatically.',
    ],
  },
  {
    version: '0.9.26',
    date: 'August 9-12, 2026',
    highlights: [
      'New Document Templates admin config (Settings > System) - MIS can now mark any of the 12 loan document templates Required or Conditional, and choose which Loan Products a Conditional template applies to, without needing a developer.',
      '"Acknowledgement Receipt" moved from an always-required document to a configurable one, and a new "Quit Claim" document template added with auto-filled bank/ATM details.',
      'Undo Restructure and Undo Adjustment actions added to a Loan Account - lets staff cleanly reverse a restructure or adjustment (removing the new loan it created and reactivating the original), after the team decided a clean removal was preferable to just marking it undone.',
      'Deed of Assignment documents now auto-fill ATM Card Number, Savings Account Number, and Branch instead of requiring manual entry.',
      'Acknowledgement Receipt switched from landscape to portrait orientation for printing, and every generated loan document now shows peso amounts with comma separators.',
      "Editable bank/ATM/allotment details for a loan application after it's no longer under active review.",
      'Automated daily backup of the whole project folder to Google Drive.',
    ],
  },
  {
    version: '0.9.25',
    date: 'August 6-9, 2026',
    highlights: [
      'New "Premium" theme (with its own light and dark look) added to Settings > Appearance and made the default appearance for every staff account.',
      'Accrued Interest now correctly shows on migrated (legacy) matured loans - it had been silently skipped for older loans.',
      'Statement of Account print refinements: larger, comma-formatted, properly-sized Remaining Amortization table; the remaining-schedule section hides itself once a loan has matured; the Penalty section shows a single "as of" date instead of implying a range; and the document reliably fits on one printed page again.',
      'Fixed date-range filters across every report (Loan Origination, Collection, Transactions, Releases, Accounts With Past Due, Collection History, Expected Collection, First Amortization, Daily Collection, Fully Paid Accounts) that were silently excluding same-day records recorded early in the Manila business day.',
      'Transaction Report redesigned with a fixed-height scrolling table and a sticky header/total row.',
      "Removed the Repayment Schedule's Balance column at MIS's request.",
      'Dashboard: removed the Portfolio Filter card and added a time-of-day greeting header.',
      'Sidebar navigation now resets scroll position to the top when switching pages.',
      'Faster page loads platform-wide from a caching fix that stops needless re-fetching of unchanged data.',
    ],
  },
  {
    version: '0.9.24',
    date: 'August 5-6, 2026',
    highlights: [
      'New configurable Roles & Permissions system (Administration > User Accounts > Permissions) - MIS can now grant or revoke access to specific platform actions per role, instead of access being fixed in the code. Closed a real gap where document generation and e-signature sending had no role restriction at all.',
      'Removed the ceiling on Adjust Penalty, so staff can now raise a penalty above the formula result for legitimate approved exceptions, not just lower it.',
      "Fixed several places showing a borrower's name without their middle name (Loan Accounts list, Loan Detail, Dashboard drill-downs).",
      'Dashboard accuracy pass: fixed Portfolio Growth comparing a partial month against a full prior month, fixed Overdue Accounts drill-downs missing some matured/in-arrears loans, and gave Delinquency Rate/Portfolio at Risk color-coded severity.',
      'Fixed staff getting logged out of the LMS roughly every 15 minutes when accessed over the live internet tunnel, caused by a browser security policy blocking the session-refresh cookie cross-site.',
      'New automated data-integrity spot-check that runs after every legacy data update, catching a class of missing-balance-data bug on 3 more loans.',
    ],
  },
  {
    version: '0.9.23',
    date: 'August 3-4, 2026',
    highlights: [
      'New direct chat feature between a Portal client and their LMS loan officer, including a pre-chat FAQ/automated assistant and full chat logs for MIS oversight.',
      'Report accuracy fixes: Expected Collection corrected to exclude fees/penalty and show the true remaining unpaid amount; Accounts with Past Due fixed to include every account with any unpaid installment in range (not just the oldest) and to correctly compute penalty for migrated loans; Collection History corrected to exclude penalty from Amount Due/Repayment.',
      'Accounts with Past Due report gained a date-range filter.',
      'Loan Detail page restyled: balance summary redesigned as a clear hero figure plus breakdown and terms, and the Repayment Schedule restyled with grouped Amount Expected/Paid/Due columns.',
      'Client Name now shows First Middle Last across every report.',
      'Fixed the Detailed Ending Current Balance report to exclude already-closed accounts, and fixed the Aging Report to exclude penalty from its bucket totals.',
      'Fixed report due/maturity dates showing the raw UTC calendar day instead of the correct Manila-time day.',
    ],
  },
  {
    version: '0.9.22',
    date: 'July 30 - August 2, 2026',
    highlights: [
      "Fixed loan document re-signing stamping a new signature directly on top of the same person's earlier one instead of replacing it cleanly.",
      'Widened the E-Signature Logs activity panel and added the signer\'s IP address to each entry; activity logs now record specific actions instead of a generic "viewed" entry.',
      'Faster page loads across the LMS from route-based code splitting.',
      "Two-Factor Authentication's Off/On indicator in Settings is now a real, working toggle (previously visual only).",
      'Backfilled legacy attachment files from the old system, and fixed attachment downloads not reporting the correct file type.',
      "Blocked creating a Client Profile when a co-borrower's name is incomplete, preventing a data-quality gap at the source.",
    ],
  },
  {
    version: '0.9.21',
    date: 'July 27-29, 2026',
    highlights: [
      "Live penalty computation formula revised twice this period, both confirmed by MIS/business leadership: moved from monthly-compounding to a daily-prorated calculation, then further aligned to match the company's own reference spreadsheet exactly (no grace period, divided by each installment's own due-month day count). Verified to match the company's manual reference tool to the centavo on a real loan.",
      "Statement of Account's Penalty figure now reuses the exact same live formula as the Repayment Schedule for non-migrated loans, instead of a separate formula that could drift out of sync.",
      "Fixed a bug where a loan's co-borrower could go completely unrecognized by the e-signature and document-generation features whenever the co-borrower had been added through the newer Client Profile flow rather than the original application - affected every migrated loan.",
      'E-signature signing link and OTP verification can now be sent by Email as well as SMS, after discovering some mobile carriers were silently blocking link-containing text messages.',
      'New centralized E-Signature Logs report - a full record of every OTP code and signing-link sent, to which party, over which channel, and whether it was verified.',
      'Fixed several document-generation bugs affecting signature placement, including a long co-borrower name overlapping the audit-trail text below it, fixed across all affected document templates.',
      'Co-borrower must now also sign the Disclosure Statement, Promissory Note, Data Privacy and Consent Form, Loan Agreement - Seafarer, and Special Power of Attorney (previously borrower-only for most of these).',
      'Client Profile: removed a duplicate Attachments card, widened Loan History, added drag-and-drop card reordering, fixed equal-height cards, and added "no number on file" warnings on the e-signature panel.',
    ],
  },
  {
    version: '0.9.20',
    date: 'July 26, 2026',
    highlights: [
      'Fixed co-borrower last names sometimes showing blank when converting an approved loan application into a client profile - co-borrower names are now captured as separate First/Middle/Last fields from the start instead of one combined text field that occasionally failed to split correctly.',
      'Fixed co-borrower addresses not being captured at all in three different places they can be added (loan application intake, Create Client, and a client\'s own Co-Borrower card) - the address picker was missing from all three forms.',
      'Co-Borrower card on Client Profile redesigned: now edit-in-place (a client has one co-borrower, correctable if verification turns up an issue) instead of implying multiple co-borrowers could be added over time; shows full contact/employer/address details by default instead of just a name.',
      'Loan Application Detail\'s mixed "Applicant Details" card split into separate Applicant Details and Co-Borrower Details cards, and every detail field across the page gained a small icon next to its label for easier scanning.',
      'Drag-to-reorder sections (already available on Loan Detail) added to Client Profile and Loan Application Detail as well - also fixed the drag handle being effectively unclickable on both new pages due to a layout issue where it landed outside the card or overlapped a neighboring card in the two-column layout.',
      'Removed a duplicate Attachments card and widened Loan History on Client Profile for a cleaner layout.',
    ],
  },
  {
    version: '0.9.19',
    date: 'July 25, 2026',
    highlights: [
      'Loan signing now supports two signers on one document - both the borrower and, when there is one, the co-borrower can each sign in their own place on the same generated loan document, instead of only the borrower having a signing step.',
      'Added an "Add Co-Borrower" option on Client Profile, so a co-borrower can be recorded for a client even if their original loan application never named one. (Redesigned into an edit-in-place card the very next day - see the entry below.)',
      'Removed the Agency Verification required-fields gate for Seafarer Loan pre-approval that had been added the day before, after it turned out to be blocking pre-approval more than intended.',
      'Reports Hub cards gained the same soft shadow treatment applied platform-wide the day before.',
    ],
  },
  {
    version: '0.9.18',
    date: 'July 24, 2026',
    highlights: [
      'New Loan Restructure - for an overdue or matured loan, close it and open a new loan account carrying its full outstanding balance forward, with staff choosing the new term and first due date. Limited to once per loan account, and only for MIS and Accounting.',
      'New Loan Adjustment - for a brand-new loan with zero payments made yet, before its first due date, move the first due date without changing anything else about the loan. Also once per loan account, MIS and Accounting only.',
      'Loan Detail page redesigned: one primary action button per loan status (e.g. Record Payment) with every other action (Undo Disburse, Restructure, Loan Adjustment, Edit) grouped into a single "More actions" menu instead of a growing row of buttons, and key balance figures given clearer visual hierarchy.',
      'Platform-wide card shadow added so cards read more distinctly against the page background, in both light and dark mode.',
      'System page\'s "Reminders" tab renamed "Messaging & Alerts" to better reflect everything it actually covers (payment reminders, e-signature SMS, Portal verification).',
      'Dashboard\'s Recommendation card is now fully live - shows the real, current count of Good/In Arrears/Matured accounts behind each recommended action instead of a static label. This was the last remaining non-live element on the Dashboard.',
    ],
  },
  {
    version: '0.9.17',
    date: 'July 23, 2026',
    highlights: [
      'Fixed a real bug where a client\'s loan applications, and the attachments filed under them, could silently disappear from view platform-wide - traced to a database update from an earlier merge that had updated the code but not yet been applied to the database itself.',
      'Dashboard\'s Portfolio Growth and Collections vs. Target cards now compute from real data (month-over-month disbursement, and a rolling 3-month collections average) instead of placeholder sample numbers.',
      'Dashboard given a more focused color treatment - one hero metric (Portfolio Growth) highlighted, and every chart\'s accent color unified to the platform\'s single primary color instead of a different arbitrary color per chart.',
      '"Mode of Payment" renamed to "Channel" and expanded to the company\'s full real list of payment channels, with a follow-up review correcting a couple that shouldn\'t have been offered.',
      '"Reduce Penalty" renamed to "Adjust Penalty," and can now raise a penalty as well as lower it.',
      'Client and Loan Account pages now also show the documents originally uploaded during the loan application (previously visible only on the application itself), plus a full disbursement fee breakdown.',
      'Dashboard stat cards can now be dragged to reorder, and Settings\' layout controls were simplified.',
      'Loan Application\'s Agency Verification fields (for Seafarer Loans) grouped into collapsible sections instead of one long list.',
    ],
  },
  {
    version: '0.9.16',
    date: 'July 22, 2026',
    highlights: [
      'New Settings > Security > Recent Sign-in Activity - shows your last 20 sign-in attempts, successful or not, so a run of failed attempts you don\'t recognize is visible directly on your own account.',
      'New Settings > Security > Two-Factor Authentication - optionally require a one-time code, sent by email or SMS, on top of your password when signing in. Off by default for every account; turning it on requires confirming a real code first, so a mistyped phone number or an unreachable inbox can never lock an account out.',
      'Merged two "What\'s New" entries that had landed on the same calendar day into one, and fixed this About page\'s own "sample data, not connected to live systems" wording, which had gone stale since the platform was wired to real data many releases ago.',
    ],
  },
  {
    version: '0.9.15',
    date: 'July 21, 2026',
    highlights: [
      'New Settings > Security > Active Sessions - see every device currently signed in to your account (browser/OS, IP, when it signed in) and sign any of them out individually, or all other devices at once.',
      'Loan Application\'s Review Report redesigned to match the company\'s official Credit Evaluation Report template and renamed to match - per-party CMAP/KYC/Myscore checks for the borrower and co-borrower, ATM/allotment payment-mode details, and a dedicated Agency/Contract/Allotment verification section for Seafarer Loans, whose Agency Name/Position/Vessel fields are now required (and enforced by the system, not just noted) before a Seafarer Loan application can be tagged Pre Approval.',
      'The Document Checklist on a Loan Application now tracks Verified/Rejected per document (with a reason, and who/when last touched it) instead of a plain checkbox, and now starts already populated from the documents actually uploaded during intake instead of empty every time.',
      'Removed the Underwriter Assessment section (risk grade, recommendation, collateral, co-maker) added the day before - no real data behind it yet, so it was cleanly dropped rather than left half-finished.',
      'The Underwriting section (Decision Scoring, Credit Evaluation Report, Document Checklist, product type/class assignment) and the Notes log no longer appear on a Loan Application until Start Review has actually been clicked - previously visible even on a brand-new, not-yet-reviewed application.',
      'Fixed the ZIP Code field not auto-filling when editing an existing client\'s already-saved address (previously only worked when picking a brand-new address); Metro Manila addresses (e.g. Makati) now auto-fill the correct barangay-specific ZIP code instead of staying blank, since a single Metro Manila city can have 30+ different ZIP codes depending on the barangay.',
      'Attachment, Statement of Account, and generated Loan Document preview pop-ups enlarged, and gained an "Open in new tab" option for a full-size view.',
    ],
  },
  {
    // 2026-07-23: merged from two same-day entries (was separately 0.9.15 and 0.9.14, both dated
    // July 20, 2026) - one release, one version bump, one changelog entry per calendar day (same
    // convention as the 0.9.6 entry further below).
    version: '0.9.14',
    date: 'July 20, 2026',
    highlights: [
      'List of Loan Accounts gained Product Type and Product Class filters (Product Class narrows to the selected Product Type, same as the Create Loan Account picker).',
      'List of Loan Applications gained a "Loan Account" column, linking straight to the loan account an approved application turned into - also added as its own field on the application\'s own detail page.',
      'Loan Account details: "Undo Disburse" is now disabled with an explanation once a payment has already been recorded against the loan, instead of only failing after being clicked.',
      'Staff Accounts table now shows each member\'s Role Class (their specific job title, e.g. "MIS Manager") instead of their broader Role Type.',
      'Role Type names spelled out in full on User Accounts instead of abbreviated (e.g. "Management Information System" instead of "MIS"), and two were renamed at MIS\'s request: "Loan Operation Manager" is now "Loan Operation Management", and "Collection Officer" is now just "Collection".',
      'Product Types moved from Administration > System into its own tab under Loan Products, since it\'s specifically about the Loan Products catalog.',
      'Fixed a console warning ("Maximum update depth exceeded") on List of Loan Applications caused by an unstable reference in the shared pagination helper - also benefits every other paginated list page.',
      'Administration reorganized into one "System" page (Reminders, User Accounts, Loan Products, Product Types, Activity Logs as tabs) instead of several separate menu entries - and About moved out into its own new "Support" section so it\'s no longer buried under Administration.',
      'Staff Accounts: clicking a member\'s name now opens their full Member Profile (contact number, address, birthday, company ID, and more) - the Actions column and per-row Edit button were removed from the table in favor of this.',
      'Settings > Profile: Address is now the same Region → Province → City/Municipality → Barangay cascading picker used elsewhere in the app, instead of a free-text box.',
      'Roles tab overhauled for easier setup: inline quick-add per Role Type (no dialog needed), a live staff-count badge on every Role Class, the ability to move a Role Class to a different Role Type, and a Delete option (blocked automatically if staff are still assigned to it).',
      'New Product Types tab (Administration > System) - MIS can now rename how each Loan Products category is labeled (e.g. "Seafarer Loan"), and the new name shows up everywhere it\'s used - the Loan Products catalog, Create Loan Account, and Loan Applications.',
      'Fixed a definition tooltip (the small "i" icon next to role abbreviations like MIS/LOM/CRM) getting visually cut off when it appeared inside a pop-up dialog.',
      'Fixed the Dashboard occasionally failing to load entirely with a generic error screen after a backend update, caused by a newer chart expecting data an older backend deployment didn\'t send yet.',
    ],
  },
  {
    version: '0.9.13',
    date: 'July 19, 2026',
    highlights: [
      'Fixed the app shell so the sidebar menu and the main page now scroll independently of each other, instead of scrolling the side menu also moving the whole page.',
    ],
  },
  {
    version: '0.9.12',
    date: 'July 18, 2026',
    highlights: [
      'New Topbar Global Search - search across Clients, Loan Accounts, and Loan Applications at once from a single search bar, with grouped results linking straight to each record.',
      'Notification Center now runs on a real background schedule - overdue-loan notifications are generated every 15 minutes automatically, instead of only when someone happened to open their notification bell.',
      'Loan Applications gained bulk actions - select multiple not-yet-decided applications and Decline Selected in one step (bulk-approve was deliberately left out, since each approval still needs its own product assignment).',
      'New in-app Help - a "?" button in the Topbar with contextual guidance for whichever page you\'re on, plus a browsable list covering every section of the platform.',
      'Automatic SMS payment reminders - the full 5-stage schedule (5/3/1 days before due, on due date, weekly past due) now sends real text messages through EasyCash\'s existing M360/Globe SMS account, on a daily schedule, with a delivery-status badge on each Loan Account.',
      'Automatic Email payment reminders - the same reminder schedule now also sends from EasyCash\'s own collections@easycash.ph mailbox, with a matching status badge.',
      'SMS and Email reminder logs unified into one Reminder Logs page (also linked from the Reports Hub), showing every reminder actually sent with per-channel delivery status.',
      'New MIS-only Settings > System toggle for the SMS/Email reminder channels - takes effect on the next scheduled run, no server restart needed; both default off, and were then temporarily locked in the UI to prevent accidentally switching either on before content and test sends are fully verified.',
      'Fixed 16 backend tests left stale by the Under Review / Pre Approval pipeline refactor and a Borrower controller signature change - full backend test suite now passes 710/710 (711 after the reminder-settings tests landed).',
    ],
  },
  {
    version: '0.9.11',
    date: 'July 17, 2026',
    highlights: [
      'Loan Application decision pipeline gained two real manual stages between the system\'s automatic pre-screen and the final call: "Under Review" (CRM/MIS records Credit Investigation notes, Credit Bureau result, and a document checklist as a structured Review Report) and "Pre Approval" (tagged once that report is complete) - matching the company\'s actual approval process instead of one direct Approve/Decline step. The final Approve is now restricted to MIS and Loan Operation Manager only - CRM\'s role stops at Pre Approval.',
      'New Dashboard "Loan Application Pipeline" funnel chart - Total Applications through Released, with Declined branching off after Underwriting, built from real application counts at every stage.',
      'Settings > Appearance overhauled with five new personalization options, saved per staff account: Dashboard Layout (compact/comfortable, reorder or hide stat cards), Text Size (small/medium/large, scales the whole app), Landing Page (choose which page you land on after signing in), a Custom Accent Color picker, and the existing sidebar-collapsed preference is now per-account instead of shared on one machine.',
      'Notification Center added platform-wide - a bell icon with real, persisted notifications for application submitted, ready for final approval, approved/declined, and loan overdue, each linking straight to the record.',
      'Widened several data-entry pop-up forms that felt cramped for how many fields they hold - Edit Client Details, Create Client Profile, Create Loan Application, Create Loan Account, and Record Payment now use noticeably more of the screen.',
      'Fixed Record Payment sometimes not prefilling the payment amount - caused by the dialog auto-focusing the amount field the instant it opened, which the field mistook for an in-progress manual edit.',
      'Fixed an overpaid loan\'s credit balance silently displaying as ₱0.00 instead of the real negative (credit) figure, in the loan list, loan summary, and the post-payment confirmation screen - the confirmation now also labels it clearly as "credit (overpaid)."',
      'Fixed the Repayment Schedule\'s Balance column staying pinned at the full loan amount on every row until at least one payment was recorded, instead of declining installment by installment the way an amortization schedule should from day one.',
    ],
  },
  {
    version: '0.9.10',
    date: 'July 16, 2026',
    highlights: [
      'Create Loan Account: Add-On Rate is now a dropdown sourced from the official Interest Rate Chart instead of free-typed, Contractual Rate auto-computes and can no longer be accidentally overwritten, and Term prefills from the client\'s requested term.',
      'A Loan Account that hasn\'t been Activated yet now shows a clearly-labeled repayment schedule preview instead of "No repayment schedule found."',
      'Loan Account and Loan Application statuses relabeled for clarity: an Approved loan awaiting disbursement now reads "For Disbursement," and a Loan Application whose loan has been disbursed now reads "Disbursed."',
      'Financial amounts, contact numbers, and SSS/TIN numbers now format live while typing (thousand separators, "09XX XXX XXXX", "XXXX XXXX XXXX") throughout the platform, instead of only after leaving the field.',
      'Fixed a platform-wide bug where clicking a dropdown field inside any pop-up form, then clicking elsewhere to dismiss it, closed the entire form and lost everything already entered.',
      'Co-Borrower details on a Loan Application streamlined to name, relationship, contact number, email, and address; starting an application from an existing client now offers a dropdown of their previous co-borrowers with one-click autofill, while a brand-new applicant\'s form stays as-is.',
      'Fixed "Create Client Profile" not carrying an approved applicant\'s saved address into the Region/Province/City/Barangay dropdowns.',
      'Fixed the product-class list shown when approving a Loan Application, which had gone stale and was missing several currently-active products.',
      'List of Loan Applications, List of Clients, and List of Loan Accounts: fixed status/category/product filters sometimes showing fewer results than actually match, and added a dedicated "Matured" status filter for Loan Accounts (previously mixed into "In Arrears").',
      'Record Payment on a Loan Account now opens in place as a dialog instead of navigating to a separate page, and the loan\'s balance now updates immediately afterward instead of requiring a manual refresh.',
      'Fixed the About page (and other pages) sometimes rendering with content cut off behind the Windows taskbar at 100% browser zoom.',
    ],
  },
  {
    version: '0.9.9',
    date: 'July 15, 2026',
    highlights: [
      'Dashboard\'s Portfolio Breakdown chart redesigned: replaced the donut chart with proportional bars sized by each product category\'s real share of the portfolio, still showing the Active/Past Due/Matured split with peso amounts and account counts per segment.',
      'Fixed a Dashboard drill-down bug where clicking Good/In Arrears/Matured could show a mismatched status label on some listed loans - the underlying list itself was always correct.',
      'Completed optional loan-document mapping for every Salary Loan and Business Loan product (Seafarer Loan products were completed the day before) - the right optional documents (Deed of Assignment, Loan Agreement, Manulife, etc.) now appear for every product family.',
      'Payment Reminders gained a Due Date range filter, a totals row (Principal/Interest/Penalty/Fees/Total Due across every filtered result), better filter-bar alignment, and a smaller 50-row page size.',
      'Fixed Payment History transaction ordering - a reversal or disbursement no longer appears above a more recent repayment made the same day.',
      'Added a Total Due column to the Repayment Schedule table, and fixed the Paid/Balance columns undercounting an installment\'s fees and penalty payments - an installment fully paid including a fee or penalty could look incomplete, and the running balance could get stuck instead of decreasing.',
      'Payment Recording gained a live "Next due" summary, and now shows a full confirmation screen after a payment (amount applied, exact per-installment breakdown, new balance) instead of closing silently.',
      'Payment History rows can now be expanded to see exactly which installment(s) a payment was applied to and the exact split - already caught a genuine ₱0.02 cashier data-entry discrepancy on its first real use, corrected immediately.',
    ],
  },
  {
    version: '0.9.8',
    date: 'July 14, 2026',
    highlights: [
      'Loan document generation (Promissory Note, Disclosure Statement, and others) confirmed fully working end to end in the real deployment, including the full per-installment repayment schedule table on each document.',
      'Added an inline PDF Preview button next to Download on a Loan Account\'s Documents card, so a generated document can be reviewed without downloading it first.',
      'Fixed a bug where opening a direct link to (or refreshing) a Loan Account, Client, or Loan Application page showed a "not found" error instead of the page.',
      'Fixed generated PDF documents occasionally rendering as blank boxes instead of readable text.',
      'Fixed a data bug affecting all 1,790 migrated loan accounts where the "Net Proceeds" figure on generated documents always showed ₱0.00 regardless of the real amount.',
      'Optional loan documents (Loan Agreement - Seafarer, Special Power of Attorney, Deed of Assignment, Manulife) now correctly appear for every Seafarer Loan product.',
    ],
  },
  {
    version: '0.9.7',
    date: 'July 13, 2026',
    highlights: [
      'Renamed sidebar labels for clarity: "Client Data" is now "Clients," and "Member Management" is now "User Accounts."',
      'Fixed three real Dashboard accuracy bugs, all traced to the same stale legacy field: Overdue Accounts, Delinquency Rate/Portfolio at Risk, and Loan Portfolio Health\'s "Matured" segment (which had always shown zero) now all compute correctly - Matured alone surfaced roughly ₱56M of credit-loss exposure that wasn\'t visible before.',
      'Removed a fabricated Dashboard trend figure and fixed a "Collections This Month" comparison that had been measuring a partial month against a full previous month.',
      'Softened the sidebar\'s active-page highlight styling so it no longer visually clashes with warning-colored banners.',
    ],
  },
  {
    // 2026-07-16: merged from two same-day entries (was separately 0.9.7 and 0.9.6, both dated
    // July 12, 2026) - one release, one version bump, one changelog entry per calendar day.
    version: '0.9.6',
    date: 'July 12, 2026',
    highlights: [
      'The Loan Application page now recognizes when an applicant has already been turned into a client - the "Create Client Profile" button is replaced with a link straight to their existing Client Profile, preventing duplicate client records.',
      'Client Profile now has a real, working "Create Loan Account" button - loan officers can originate a new loan account directly from an approved client, no longer a preview-only demo.',
      'Loan Account details gained real Approve and Activate buttons - moving a loan from Pending Approval, to Approved, to Active is now a real action, not a simulation.',
      'Client Profile and Loan Account pages now have real file Attachments (upload, view, download) - previously only available on Loan Applications.',
      'Loan Account details gained a real Notes feature - staff can leave a running log of notes on any loan account, visible to everyone with access, saved permanently.',
      'Loan Account details gained a real Reminders panel showing the confirmed 5/3/1-days-before, due-date, and weekly-past-due reminder schedule for that loan\'s next payment - actual SMS/Email sending is coming soon, pending a messaging provider.',
      'The Dashboard\'s Collections Forecast chart now shows a real projection - built bottom-up from every active loan\'s actual repayment schedule - instead of a sample illustration.',
      'New Activity Timeline on Loan Applications, Client Profiles, and Loan Accounts - shows exactly who did what and when on that specific record (documents uploaded, decisions made, payments recorded), visible to every staff member.',
      'A page-level "Recent Activity Logs" panel was added throughout the platform, and the master Activity Logs page (Administration) now records every meaningful action across the system - not just logins and loan decisions. Closed several gaps where real actions (creating a client, submitting a loan application, adding/editing/removing a staff member, adding a Role Class) were happening without leaving any record.',
      'Administration > Members is now fully self-service for MIS: add, edit, and remove staff accounts, reset a member\'s forgotten password, and organize staff under Role Types (MIS, LOM, CRM, Finance, Accounting, Collection) with their own job-title Role Classes (e.g. "MIS Manager", "Field Collector") - all editable from a new Roles tab.',
      'Every sensitive field in Edit Member Details and Edit Client Details (email, password, company ID, and personal details) now starts locked, requiring a deliberate click to unlock before it can be changed - a safety measure against accidental edits.',
      'Loan Application intake and Client Profile creation now capture and carry through the applicant\'s full details end to end - Gender, Civil Status, Date of Birth, Place of Birth, Nationality, Home Ownership, Occupation, Office Address, TIN, SSS No., Dependants, Co-Borrower (including their employer), Character References, and a free-text Note - all of which previously stopped at the intake form and never reached the real Client Profile.',
      'Added hover tooltips throughout the Loan Application form, Client Edit, and Payment Recording explaining what each field is for, plus full meanings for abbreviations like MIS, LOM, and CRM.',
      'Settings gained an English/Filipino language switcher (Dashboard and Settings translated as the first pages), and a fuller User Profile (photo, contact number, address, birthday). Theme Color was merged into the Appearance tab.',
      'All mobile/contact number fields across the platform were relabeled "Contact Number" with a consistent "09XX XXX XXXX" format hint.',
      'Continues this platform\'s ongoing effort to replace remaining preview/sample data with live, real data as Easycash LMS moves toward fully replacing the SDevTech system.',
    ],
  },
  {
    version: '0.9.5',
    date: 'July 11, 2026',
    highlights: [
      'Loan applications are now automatically pre-classified Pre-approved or Pre-declined by the system itself - based on the applicant\'s age, whether income covers the loan\'s estimated payment, and how far their home address is from the branch - replacing the old "Pending Review" step. The loan officer still makes the real, final Approved/Declined decision; the system\'s classification is advisory only.',
      'Loan Applications and Client Profiles now show a real Risk & Payment Summary - how many days a loan is overdue, how many payments were ever late, and an overall risk level - computed by the LMS itself from real repayment history.',
      'Loan Account details now show which specific installments were late (matching the count in the Risk Assessment summary above it), plus a full Payment History tab showing every transaction on the account - disbursement, repayments, and fees.',
      'Loan Application details now show a Decision Scoring breakdown - age, income vs. loan amount, and address proximity to the branch, each shown pass or fail with the actual numbers behind it - so it\'s clear exactly why the system pre-approved or pre-declined an applicant, not just the final result.',
      'Loan officers can now upload specific applicant documents during intake - profile picture, valid ID, proof of billing, and loan-type-specific documents (employee ID, business clearance, seaman\'s book, etc.) - tagged by document type, with an in-app preview so reviewing no longer requires downloading first. The applicant\'s uploaded profile picture now appears as their photo throughout the Loan Applications area.',
      'An optional AI-assisted auto-fill can now read an uploaded ID or payslip (using a local, on-premises AI model - no data leaves the company\'s own systems) and suggest values for the loan application form, which the loan officer always reviews before submitting.',
      'Fixed address and mobile number formatting throughout Loan Applications and Client profiles - addresses and phone numbers now display consistently instead of a mix of ALL CAPS and lowercase.',
      'Fixed a bug where visiting a Client Profile before a Loan Application could cause the application page to show an error screen; also fixed several smaller display issues.',
    ],
  },
  {
    version: '0.9.4',
    date: 'July 10, 2026',
    highlights: [
      'Dashboard, Loan Applications, Activity Logs, Member Details, Payment Reminders, and Loan/Collection/Transaction Reports are now wired to the real backend, replacing sample data - the platform has no remaining mock-only pages except Settings and About.',
      'Member Details can now add and edit real staff accounts (name, email, role, status), backed by a real account-management API.',
      'Fixed a real data-quality issue: about 68% of migrated client addresses had been stored as raw geographic codes instead of place names. Imported the official Philippine address reference data (regions, provinces, cities/municipalities, barangays) and corrected 940 of 944 affected records.',
      'Client Edit now uses a real cascading Region → Province → City/Municipality → Barangay address picker instead of free text, so an address can\'t be saved as a raw code again.',
      'Search boxes on Client Data, Loan Applications, Loan Accounts, Member Details, and Activity Logs now search the full dataset on the server instead of only what was already loaded on screen.',
      'Fixed slow page loads on list pages: each now loads 100 records at a time with Next/Previous paging, instead of loading the entire dataset up front.',
      'Login page and app header now show the platform\'s official name, Easycash Loan Management System Platform.',
    ],
  },
  {
    version: '0.9.3',
    date: 'July 9, 2026',
    highlights: [
      'Migrated the company\'s real production data into the platform\'s own database for the first time: 4,604 borrowers, 44 loan products (with their versions), 1,790 loan accounts, 280,172 transactions, 251 co-borrowers, 2,372 addresses, 440 ID documents, and 334 income records - sourced from the legacy system export, not sample data.',
      'Client Data (list and profile) now shows this real, migrated client data instead of sample data.',
      'Loan Accounts (list and detail) now shows this real, migrated loan data instead of sample data. Fixed a pagination bug that had been silently truncating long lists, and a status-naming mismatch left over from the legacy system.',
      'Loan Products now shows the real, migrated product catalog (view-only, since editing a live product safely needs its own dedicated workflow, planned separately).',
      'Statement of Account now generates from real loan data for a migrated loan account.',
      'Fixed a login bug where a background session check could occasionally interrupt a login that had just succeeded.',
    ],
  },
  {
    version: '0.9.2',
    date: 'July 8, 2026',
    highlights: [
      'Removed the standalone Generated Documents page - a loan account\'s generated documents (Promissory Note, Disclosure Statement, Loan Agreement, Deed of Assignment, Data Privacy Consent Form, Amortization Schedule, and more) now live on that loan account\'s own Attachments tab, alongside manually-uploaded files.',
      'Loan Products now show each product\'s loan document templates (matching the company\'s real legal templates), editable per product - including a seafarer-specific set (Loan Agreement, Deed of Assignment, Special Power of Attorney) for Seafarer Loan products.',
      'Dashboard bug fixes: chart tooltips now match the app\'s dark theme instead of flashing white; Collections Forecast and Portfolio Breakdown by Loan Category no longer overflow their card boundaries; Portfolio Breakdown\'s chart is now a compact side-by-side layout instead of a tall stacked one; Business Loan and Seafarer Loan no longer share the same chart color.',
      'Create Loan Account form (Client Profile) expanded to match the official calculator\'s loan encoding fields - Contractual Rate, Anticipated Disbursement Date, Co-Borrower Name - plus a live Computation Summary (Monthly Amortization, Total Interest, fees, Net Proceeds, EIR Monthly/Annual) computed with the same confirmed formulas as the rest of the platform.',
      'Create Loan Account form now uses the official Interest Rate Chart (Add-On Rate → Contractual Rate lookup) and reproduces every fee\'s own Waive toggle from the real loan-encoding sheet - Account Management, Processing, Digital Signature, Notarial, Insurance, and Advance Interest fees can each be individually waived, with a running Computation Summary and support for deducting a previous loan\'s outstanding balance on renewal.',
      'Interest Rate Chart corrected and completed by cross-checking a second copy of the same official table - added a missing Add-On 5% tier and fixed the Add-On 10% tier\'s rates, which a unit error in the first copy had made look like unusable test data. Create Loan Account also gained a Disbursement section (Payment Method, and Bank Name/Account/ATM Card details for bank-based methods), matching the official records\' own field set.',
      'Documentary Stamp Tax now has its own Waive toggle on Create Loan Account, defaulted to waived (every other fee still defaults to charged).',
      'Loan Applications are now linked to the Loan Account they become: a client can only get a new loan account from a specific approved application (renewals need their own approved application too), Loan Application detail now has a "Create Loan Account" step (prefilled from the application) once Create Client has been used, and a Loan Account shows a link back to the application it came from. The final "Yes, create" button on Create Loan Account also now holds for 3 seconds before it can be clicked, as an extra safety net on top of the existing confirmation step.',
      '"Approve Loan" and "Activate Loan" on a Loan Account are now real actions (previously both were placeholder "Coming Soon" buttons) - approving moves a loan from Pending Approval to Approved, and activating disburses it: generates its full repayment schedule and moves it to Active, completing the loan application → client → loan account → disbursement workflow end to end.',
      'Fixed a bug where "Record Payment" on a freshly created/activated loan account could land on Payment Recording with a different, unrelated loan preselected instead of the one just clicked from.',
    ],
  },
  {
    version: '0.9.1',
    date: 'July 7, 2026',
    highlights: [
      'New Loan Portfolio Health panel on the Dashboard: a Good / In Arrears / Matured breakdown with per-segment income and loss figures (Interest Income, Accrued Revenue, Credit Loss).',
      'Portfolio Quality Metrics using standard lending indicators - Delinquency Rate, Portfolio at Risk (PAR), and Average Loan Size - each with an in-app definition.',
      'Every chart, graph, and metric is now clickable and drills down to the exact loan accounts behind the figure.',
      'LMS Configuration: change the platform theme color (Easycash Emerald by default) and switch light/dark mode.',
      'Sidebar reorganized into Home, Loan, Collection, and Administration, and it now follows the selected theme.',
      'Added this About page with the LMS version number and changelog, developer team, and information on the planned future Easycash Portal client app.',
      'Portfolio Breakdown by Loan Category and Loan Portfolio Health can now be filtered by loan category and date range, with every total recomputing live.',
      'Dashboard recommendations renamed from "AI Portfolio Assist" to "Recommendation".',
      '"Back" buttons now return to wherever you actually came from, instead of always resetting to a blank list.',
      'New "Create Application" button on Loan Applications: a loan officer can now encode a walk-in applicant\'s application, following the company\'s official paper form (ECLC-LOFN01) section for section.',
      'Search and filter added to Client Data (by branch and loan status), Payment Recording (find a loan account by borrower or code), and Payment Reminders (search by borrower or loan account).',
      'Client names are now clickable throughout - on Loan Accounts and on a Loan Application (when the applicant is already an official client) - linking straight to their Client Profile.',
      'Portfolio Filter moved to the top of the Dashboard and now drives every portfolio card (Overview, Quality Metrics, Loan Disbursement Trend, Collections vs. Target, Portfolio Breakdown, Loan Portfolio Health), not just two of them.',
      'Collections Forecast and Loan Disbursement Trend now compute from each loan\'s own real repayment schedule instead of an illustrative random trend.',
      'This About page\'s version and "Updated on" date now update automatically from the changelog below, instead of being maintained separately.',
    ],
  },
  {
    version: '0.9.0',
    date: 'July 6, 2026',
    highlights: [
      'Loan Applications module: intake list and detail with a risk-assessment summary and an approve / decline review workflow.',
      'Payment Reminders: automated 5/3/1-day, due-date, and weekly schedules across SMS, email, and dashboard channels.',
      'Loan Application → Client → Loan Account workflow, with repeat-client detection.',
      'Sortable column headers across every table, defaulting date columns to newest-first.',
      'Manual payment-allocation option on the Payment Recording screen.',
      'Generated Documents registry under Administration.',
    ],
  },
  {
    version: '0.8.0',
    date: 'July 5, 2026',
    highlights: [
      'First internal UI preview: Dashboard, Loan Accounts, Client Data, Loan Products, Payment Recording, and Reports (Loan / Collection / Transaction).',
      'LMS Administration: Member Details and Activity Logs.',
      'Light and dark themes with the official Easycash branding.',
    ],
  },
];

/** Derived from the changelog above - see its doc comment. Never set these independently. */
export const LMS_VERSION = LMS_CHANGELOG[0]!.version;
export const LMS_UPDATED_ON = LMS_CHANGELOG[0]!.date;

/**
 * Companion changelog for the client-facing Easycash Portal (added 2026-08-19, user request) -
 * shown on the LMS About page alongside the LMS's own changelog so a stakeholder can see the
 * complete platform's history in one place, not just the internal staff app. Same
 * plain-language, stakeholder-facing convention as `LMS_CHANGELOG` - see its doc comment.
 * `PORTAL_VERSION`/`PORTAL_UPDATED_ON` below are derived the same way, from `PORTAL_CHANGELOG[0]`.
 */
export const PORTAL_CHANGELOG: LmsChangelogEntry[] = [
  {
    version: '1.4.0',
    date: 'August 13, 2026',
    highlights: [
      'Official Easycash bank account details added to the "Ways to Pay" section for clients paying by bank transfer.',
      'Upload Proof of Payment for Bank Transfer payments - clients can now attach a receipt/screenshot directly against a loan account.',
      "Statement of Account and Payoff Amount are disabled until a loan has actually been disbursed, avoiding a confusing request for documents that don't exist yet.",
      'Dashboard redesigned with a compact 2-per-row card layout and a dedicated bank-account card.',
      'Clarified that the Personal Loan product is only available to private-sector employees.',
      'System Announcement popups added (shared with the LMS) so MIS can post maintenance/news notices to Portal visitors too.',
    ],
  },
  {
    version: '1.3.0',
    date: 'August 3-6, 2026',
    highlights: [
      'Existing borrowers can now chat directly with their LMS loan officer from the Portal, starting with a pre-chat FAQ/automated assistant.',
      'Self-service account tools: "Total Outstanding" summary, self-service Statement of Account download, Payoff Amount lookup, "Next Payment Due" reminder, and a "Recent Payments" widget added to the client Dashboard.',
      "A Portal account can now be linked (bound) to a client's existing loan history by matching email address, so a returning borrower sees their real loan data without a fresh application.",
      'Self-service "Delete My Portal Account" option added, blocked automatically while an active loan exists.',
      'Security hardening: security-response headers, image lazy-loading, gzip compression, and rate limiting added to the live Portal.',
    ],
  },
  {
    version: '1.2.0',
    date: 'July 30 - August 1, 2026',
    highlights: [
      'Two-factor authentication added to Portal login, on by default, plus a hard age-eligibility check on loan applications.',
      '"Remember this device" option added at login so a trusted device can skip repeat OTP verification.',
      'Fixed leaving the signup verification page from becoming a dead end - verification progress now persists.',
      'Per-loan-type document upload with an "Other" slot and a missing-documents indicator.',
      'Profile, Security, and loan-application editing now open as in-page dialogs instead of full separate pages.',
    ],
  },
  {
    version: '1.1.0',
    date: 'July 29, 2026',
    highlights: [
      'Applicant profile view/edit and a Security tab added, with avatar upload.',
      'Landing page trust strip added near the main Apply button - SEC-registration badge, a "we never ask for advance fees" notice, and a data-protection line.',
      "New Basic Eligibility Self-Check - a quick 4-question yes/no check against Easycash's own published requirements, entirely on-device with nothing submitted or stored.",
      'Fixed six public pages still showing hardcoded English despite the site supporting English/Filipino.',
      'Persistent "Apply Now" bar added on mobile once the main hero button scrolls out of view.',
      'New Privacy Policy and Terms pages.',
    ],
  },
  {
    version: '1.0.0',
    date: 'July 27-28, 2026',
    highlights: [
      'Public launch of the Easycash Portal - landing page, loan calculator, requirements, security-tips, and complaints pages, alongside the existing loan-application flow.',
      'Bilingual English/Filipino support added across the site.',
      'New News section for company announcements, launched empty rather than with placeholder content.',
      'Regulatory disclosure footer added to every public page (legal name, SEC registration number, Certificate of Authority number, official contact channels).',
      'Fabricated star-rating graphics removed from landing-page testimonials, since no real review system exists behind them.',
      'Site-wide SEO groundwork: page titles/descriptions, social-sharing preview tags, structured company data.',
    ],
  },
];

export const PORTAL_VERSION = PORTAL_CHANGELOG[0]!.version;
export const PORTAL_UPDATED_ON = PORTAL_CHANGELOG[0]!.date;

/** Structured "app store"-style facts shown on the About page. */
export const LMS_ABOUT_FACTS: { label: string; value: string }[] = [
  { label: 'Version', value: `${LMS_VERSION} (${LMS_BUILD_STAGE})` },
  { label: 'Updated on', value: LMS_UPDATED_ON },
  { label: 'Released on', value: LMS_RELEASED_ON },
  { label: 'Offered by', value: LMS_COMPANY },
  { label: 'Developed by', value: LMS_DEVELOPER_TEAM },
  { label: 'Environment', value: LMS_ENVIRONMENT },
  { label: 'Requires', value: 'A modern web browser (Chrome, Edge, or Firefox)' },
  { label: 'Access', value: 'Internal use - company staff and officers only' },
];

/**
 * Feature sections for the "About this app" body - describes what the finished
 * platform does (per the project objectives), written for a non-technical reader.
 */
export const LMS_ABOUT_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'LOAN MANAGEMENT SYSTEM',
    body: 'Originate and service loans end to end - borrowers and co-borrowers, versioned loan products with configurable interest, fees, and penalties, activation, and payment recording with automatic or manual allocation. Each approved loan keeps an immutable snapshot of the rules used at approval, so editing a product never changes historical loans.',
  },
  {
    heading: 'ONLINE LOAN APPLICATION',
    body: 'Receive applications from the public application portal, review them with a system-computed risk summary and decision scoring breakdown, assign the right product sub-type, and approve or decline with a confirmation-gated workflow. Repeat clients are detected automatically, with their prior payment history surfaced during review.',
  },
  {
    heading: 'PAYMENT & COLLECTION',
    body: 'Record payments across every mode of payment, follow the fees → penalty → interest → principal allocation order, and drive collections with automated reminders before and after the due date. Late accounts, penalty income, and door-to-door cash assignments are all tracked.',
  },
  {
    heading: 'MANAGEMENT DASHBOARD & ANALYTICS',
    body: 'See portfolio health at a glance - good, in-arrears, and matured accounts; interest income and credit-loss exposure; delinquency rate and portfolio at risk. Every figure is clickable and drills down to the accounts behind it. Loan, Collection, and Transaction reports round out the picture.',
  },
  {
    heading: 'DOCUMENT MANAGEMENT',
    body: 'Keep the official documents produced when a loan is activated - Promissory Note, Disclosure Statement, Loan Agreement, and Amortization Schedule - organized against each loan account, matching the company’s real legal templates.',
  },
  {
    heading: 'SECURITY & AUDIT',
    body: 'Role-based access for MIS, LOM, CRM, Finance, Accounting, and Collection Officer, with branch-scoped visibility and an activity log that records who did what and when. Sensitive borrower information stays with authorized staff only.',
  },
];
