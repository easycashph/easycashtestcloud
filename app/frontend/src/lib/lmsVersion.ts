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
  { name: 'Jomer Biason', role: 'MIS Assistant', note: 'Vibe Coder and Programmer' },
  { name: 'Nomer Perez', role: 'MIS Manager', note: 'Reviewer' },
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

/** Semantic-ish version. Pre-1.0 while the platform is in its Milestone 9.1 UI-preview stage. */
export const LMS_VERSION = '0.9.1';
export const LMS_BUILD_STAGE = 'Preview';
export const LMS_UPDATED_ON = 'July 7, 2026';
export const LMS_RELEASED_ON = 'June 2026';
export const LMS_ENVIRONMENT = 'Milestone 9.1 — internal UI preview (sample data, not connected to live systems)';

export interface LmsChangelogEntry {
  version: string;
  date: string;
  /** Optional stage label, e.g. "Preview" / "Current". */
  stage?: string;
  highlights: string[];
}

/** Newest first. Keep entries concise and plain-language — this is stakeholder-facing. */
export const LMS_CHANGELOG: LmsChangelogEntry[] = [
  {
    version: '0.9.1',
    date: 'July 7, 2026',
    stage: 'Current',
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
