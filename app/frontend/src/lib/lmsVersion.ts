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
 * Future companion product - not part of this internal LMS build, but disclosed here since it's
 * planned to consume the same backend once built (per `CLAUDE.md`'s "Customer Self-Service
 * Portal (Future)" objective). Purely informational; nothing in this app links to it yet.
 */
export const LMS_CLIENT_PORTAL = {
  androidAppName: 'Easycash Portal',
  website: 'easycashportal.ph',
  status: 'Planned - not yet built',
  description:
    'A future client-facing web/Android app where borrowers can submit a loan application online, check loan status, view transaction history, make payments, track their repayment schedule, and contact customer service - separate from this internal, staff-only LMS.',
};

export const LMS_BUILD_STAGE = 'Preview';
export const LMS_RELEASED_ON = 'July 5, 2026';
export const LMS_ENVIRONMENT = 'Milestone 9.1 - internal UI preview (sample data, not connected to live systems)';

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
