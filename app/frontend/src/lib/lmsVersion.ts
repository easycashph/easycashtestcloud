/**
 * Single source of truth for the LMS version number and user-facing changelog,
 * surfaced on the About page (Administration → About) and in the sidebar footer.
 *
 * This is the CEO/stakeholder-facing version history — plain-language highlights,
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
 * Future companion product — not part of this internal LMS build, but disclosed here since it's
 * planned to consume the same backend once built (per `CLAUDE.md`'s "Customer Self-Service
 * Portal (Future)" objective). Purely informational; nothing in this app links to it yet.
 */
export const LMS_CLIENT_PORTAL = {
  androidAppName: 'Easycash Portal',
  website: 'easycashportal.ph',
  status: 'Planned — not yet built',
  description:
    'A future client-facing web/Android app where borrowers can submit a loan application online, check loan status, view transaction history, make payments, track their repayment schedule, and contact customer service — separate from this internal, staff-only LMS.',
};

export const LMS_BUILD_STAGE = 'Preview';
export const LMS_RELEASED_ON = 'June 2026';
export const LMS_ENVIRONMENT = 'Milestone 9.1 — internal UI preview (sample data, not connected to live systems)';

export interface LmsChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

/**
 * Newest first — this array is the single source of truth for the platform's version number and
 * release date. `LMS_VERSION`, `LMS_UPDATED_ON`, and the About page's "Current" badge are all
 * *derived* from `LMS_CHANGELOG[0]` below, not maintained separately — so there is only one place
 * to update when a user-visible release ships: prepend a new entry here. (The developer-facing,
 * file-and-function-level history lives in `app/frontend/CHANGELOG.md`; keep these entries
 * concise and plain-language, translated for a non-technical reader — this is stakeholder-facing.)
 */
export const LMS_CHANGELOG: LmsChangelogEntry[] = [
  {
    version: '0.9.5',
    date: 'July 11, 2026',
    highlights: [
      'Loan applications are now automatically pre-classified Pre-approved or Pre-declined by the system itself — based on the applicant\'s age, whether income covers the loan\'s estimated payment, and how far their home address is from the branch — replacing the old "Pending Review" step. The loan officer still makes the real, final Approved/Declined decision; the system\'s classification is advisory only.',
      'Loan Applications and Client Profiles now show a real Risk & Payment Summary — how many days a loan is overdue, how many payments were ever late, and an overall risk level — computed by the LMS itself from real repayment history, not an outside AI service.',
      'Loan Account details now show which specific installments were late (matching the count in the Risk Assessment summary above it), plus a full Payment History tab showing every transaction on the account — disbursement, repayments, and fees.',
      'Loan officers can now upload specific applicant documents during intake — profile picture, valid ID, proof of billing, and loan-type-specific documents (employee ID, business clearance, seaman\'s book, etc.) — tagged by document type, with an in-app preview so reviewing no longer requires downloading first. The applicant\'s uploaded profile picture now appears as their photo throughout the Loan Applications area.',
      'An optional AI-assisted auto-fill can now read an uploaded ID or payslip (using a local, on-premises AI model — no data leaves the company\'s own systems) and suggest values for the loan application form, which the loan officer always reviews before submitting.',
      'Fixed address and mobile number formatting throughout Loan Applications and Client profiles — addresses and phone numbers now display consistently instead of a mix of ALL CAPS and lowercase.',
      'Fixed a bug where visiting a Client Profile before a Loan Application could cause the application page to show an error screen; also fixed several smaller display issues.',
    ],
  },
  {
    version: '0.9.4',
    date: 'July 10, 2026',
    highlights: [
      'Dashboard, Loan Applications, Activity Logs, Member Details, Payment Reminders, and Loan/Collection/Transaction Reports are now wired to the real backend, replacing sample data — the platform has no remaining mock-only pages except Settings and About.',
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
    date: 'July 8, 2026',
    highlights: [
      'Removed the standalone Generated Documents page — a loan account\'s generated documents (Promissory Note, Disclosure Statement, Loan Agreement, Deed of Assignment, Data Privacy Consent Form, Amortization Schedule, and more) now live on that loan account\'s own Attachments tab, alongside manually-uploaded files.',
      'Loan Products now show each product\'s loan document templates (matching the company\'s real legal templates), editable per product — including a seafarer-specific set (Loan Agreement, Deed of Assignment, Special Power of Attorney) for Seafarer Loan products.',
      'Dashboard bug fixes: chart tooltips now match the app\'s dark theme instead of flashing white; Collections Forecast and Portfolio Breakdown by Loan Category no longer overflow their card boundaries; Portfolio Breakdown\'s chart is now a compact side-by-side layout instead of a tall stacked one; Business Loan and Seafarer Loan no longer share the same chart color.',
      'Create Loan Account form (Client Profile) expanded to match the official calculator\'s loan encoding fields — Contractual Rate, Anticipated Disbursement Date, Co-Borrower Name — plus a live Computation Summary (Monthly Amortization, Total Interest, fees, Net Proceeds, EIR Monthly/Annual) computed with the same confirmed formulas as the rest of the platform.',
      'Create Loan Account form now uses the official Interest Rate Chart (Add-On Rate → Contractual Rate lookup) and reproduces every fee\'s own Waive toggle from the real loan-encoding sheet — Account Management, Processing, Digital Signature, Notarial, Insurance, and Advance Interest fees can each be individually waived, with a running Computation Summary and support for deducting a previous loan\'s outstanding balance on renewal.',
      'Interest Rate Chart corrected and completed by cross-checking a second copy of the same official table — added a missing Add-On 5% tier and fixed the Add-On 10% tier\'s rates, which a unit error in the first copy had made look like unusable test data. Create Loan Account also gained a Disbursement section (Payment Method, and Bank Name/Account/ATM Card details for bank-based methods), matching the official records\' own field set.',
      'Documentary Stamp Tax now has its own Waive toggle on Create Loan Account, defaulted to waived (every other fee still defaults to charged).',
      'Loan Applications are now linked to the Loan Account they become: a client can only get a new loan account from a specific approved application (renewals need their own approved application too), Loan Application detail now has a "Create Loan Account" step (prefilled from the application) once Create Client has been used, and a Loan Account shows a link back to the application it came from. The final "Yes, create" button on Create Loan Account also now holds for 3 seconds before it can be clicked, as an extra safety net on top of the existing confirmation step.',
      '"Approve Loan" and "Activate Loan" on a Loan Account are now real actions (previously both were placeholder "Coming Soon" buttons) — approving moves a loan from Pending Approval to Approved, and activating disburses it: generates its full repayment schedule and moves it to Active, completing the loan application → client → loan account → disbursement workflow end to end.',
      'Fixed a bug where "Record Payment" on a freshly created/activated loan account could land on Payment Recording with a different, unrelated loan preselected instead of the one just clicked from.',
    ],
  },
  {
    version: '0.9.2',
    date: 'July 7, 2026',
    highlights: [
      'New "Create Application" button on Loan Applications: a loan officer can now encode a walk-in applicant\'s application, following the company\'s official paper form (ECLC-LOFN01) section for section.',
      'Search and filter added to Client Data (by branch and loan status), Payment Recording (find a loan account by borrower or code), and Payment Reminders (search by borrower or loan account).',
      'Client names are now clickable throughout — on Loan Accounts and on a Loan Application (when the applicant is already an official client) — linking straight to their Client Profile.',
      'Portfolio Filter moved to the top of the Dashboard and now drives every portfolio card (Overview, Quality Metrics, Loan Disbursement Trend, Collections vs. Target, Portfolio Breakdown, Loan Portfolio Health), not just two of them.',
      'Collections Forecast and Loan Disbursement Trend now compute from each loan\'s own real repayment schedule instead of an illustrative random trend.',
      'This About page\'s version and "Updated on" date now update automatically from the changelog below, instead of being maintained separately.',
    ],
  },
  {
    version: '0.9.1',
    date: 'July 7, 2026',
    highlights: [
      'New Loan Portfolio Health panel on the Dashboard: a Good / In Arrears / Matured breakdown with per-segment income and loss figures (Interest Income, Accrued Revenue, Credit Loss).',
      'Portfolio Quality Metrics using standard lending indicators — Delinquency Rate, Portfolio at Risk (PAR), and Average Loan Size — each with an in-app definition.',
      'Every chart, graph, and metric is now clickable and drills down to the exact loan accounts behind the figure.',
      'LMS Configuration: change the platform theme color (Easycash Emerald by default) and switch light/dark mode.',
      'Sidebar reorganized into Home, Loan, Collection, and Administration, and it now follows the selected theme.',
      'Added this About page with the LMS version number and changelog, developer team, and information on the planned future Easycash Portal client app.',
      'Portfolio Breakdown by Loan Category and Loan Portfolio Health can now be filtered by loan category and date range, with every total recomputing live.',
      'Dashboard recommendations renamed from "AI Portfolio Assist" to "Recommendation".',
      '"Back" buttons now return to wherever you actually came from, instead of always resetting to a blank list.',
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
    date: 'June 2026',
    highlights: [
      'First internal UI preview: Dashboard, Loan Accounts, Client Data, Loan Products, Payment Recording, and Reports (Loan / Collection / Transaction).',
      'LMS Administration: Member Details and Activity Logs.',
      'Light and dark themes with the official Easycash branding.',
    ],
  },
];

/** Derived from the changelog above — see its doc comment. Never set these independently. */
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
  { label: 'Access', value: 'Internal use — company staff and officers only' },
];

/**
 * Feature sections for the "About this app" body — describes what the finished
 * platform does (per the project objectives), written for a non-technical reader.
 */
export const LMS_ABOUT_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'LOAN MANAGEMENT SYSTEM',
    body: 'Originate and service loans end to end — borrowers and co-borrowers, versioned loan products with configurable interest, fees, and penalties, activation, and payment recording with automatic or manual allocation. Each approved loan keeps an immutable snapshot of the rules used at approval, so editing a product never changes historical loans.',
  },
  {
    heading: 'ONLINE LOAN APPLICATION',
    body: 'Receive applications from the public application portal, review them with an AI-assisted risk summary, assign the right product sub-type, and approve or decline with a confirmation-gated workflow. Repeat clients are detected automatically, with their prior payment history surfaced during review.',
  },
  {
    heading: 'PAYMENT & COLLECTION',
    body: 'Record payments across every mode of payment, follow the fees → penalty → interest → principal allocation order, and drive collections with automated reminders before and after the due date. Late accounts, penalty income, and door-to-door cash assignments are all tracked.',
  },
  {
    heading: 'MANAGEMENT DASHBOARD & ANALYTICS',
    body: 'See portfolio health at a glance — good, in-arrears, and matured accounts; interest income and credit-loss exposure; delinquency rate and portfolio at risk. Every figure is clickable and drills down to the accounts behind it. Loan, Collection, and Transaction reports round out the picture.',
  },
  {
    heading: 'DOCUMENT MANAGEMENT',
    body: 'Keep the official documents produced when a loan is activated — Promissory Note, Disclosure Statement, Loan Agreement, and Amortization Schedule — organized against each loan account, matching the company’s real legal templates.',
  },
  {
    heading: 'SECURITY & AUDIT',
    body: 'Role-based access for MIS, Loan Operation Manager, CRM, Finance, Accounting, and Collection Officer, with branch-scoped visibility and an activity log that records who did what and when. Sensitive borrower information stays with authorized staff only.',
  },
];
