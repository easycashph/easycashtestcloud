/**
 * In-app Help content (2026-07-17 user request) - per-page quick-reference guidance for new
 * staff, since no onboarding material exists anywhere in this app yet (`AboutPage.tsx` is a
 * changelog/version page, not a how-to guide). Keyed by route path, matched by longest-prefix in
 * `HelpButton.tsx` against the current URL. Deliberately UI/workflow guidance only (what a page is
 * for, what buttons do) - never a financial rule or business policy statement, per CLAUDE.md's
 * "never invent business rules": those live in the app's own live-computed figures/badges, not
 * hand-written text that could drift out of sync with them.
 */
export interface HelpTopic {
  title: string;
  summary: string;
  tips: string[];
}

export const HELP_TOPICS: Record<string, HelpTopic> = {
  '/': {
    title: 'Dashboard',
    summary: 'Portfolio-wide summary - active loans, collections, overdue accounts, and trend charts. Click any figure, bar, or chart segment to see the loan accounts behind it.',
    tips: [
      'Use the Portfolio Filter to narrow every chart/figure to a category or date range.',
      'Customize which stat cards show, their order, and density in Settings > Appearance > Dashboard Layout.',
      'Pick which page you land on after login in Settings > Appearance > Landing Page.',
    ],
  },
  '/reports': {
    title: 'Reports',
    summary: 'Loan Releases, Collections, Transactions, and other operational reports, each exportable.',
    tips: ['Each report has its own filters (date range, branch, product) - set them before exporting.'],
  },
  '/applications': {
    title: 'Loan Applications',
    summary: 'Every application moves through: system pre-qualification (Requirement Compliance) → Under Review → Pre Approval → final Approve/Decline. Only MIS and Loan Operation Manager can give the final approval.',
    tips: [
      'Click a row to open the full application - review details, the AI/system pre-qualification breakdown, and the decision buttons for its current stage.',
      'Select multiple applications with the checkboxes to Decline Selected in bulk (only offered for applications not yet decided).',
      'Use "Create Loan Applicant Profile" to encode a walk-in applicant from the paper form.',
      'The Search bar in the top bar can jump straight to an application by applicant name from anywhere in the app.',
    ],
  },
  '/clients': {
    title: 'Clients',
    summary: "Every client's profile: personal details, loan history, and risk/payment summary.",
    tips: [
      'Click a row to open the full client profile.',
      'From a client profile you can start a renewal loan application or create a new loan account, once eligible.',
      'Use "Add Client" only for a genuinely new client - the system will warn about a likely duplicate (same name + birth date).',
    ],
  },
  '/loans': {
    title: 'Loan Accounts',
    summary: 'Every loan account and its status - Pending Approval, Active, In Arrears, Closed, etc.',
    tips: [
      'Click a row to open the full loan account - repayment schedule, payment history, and actions (Approve/Activate/Record Payment) valid for its current status.',
      'Filter by status or product to narrow the list before exporting or printing.',
    ],
  },
  '/payments': {
    title: 'Record Payment',
    summary: 'Search for a loan account and record a payment against it - the system automatically allocates it across fees, penalty, interest, and principal in the correct order.',
    tips: ['Double-check the borrower and loan code shown before submitting - payments cannot be un-recorded, only reversed by MIS.'],
  },
  '/reminders': {
    title: 'Due & Overdue',
    summary: "A live worklist of every loan account's next unpaid installment, upcoming or overdue - not an automated SMS/email reminder service.",
    tips: ['Click a row to jump to that loan account and record a payment or follow up.'],
  },
  '/configuration/settings': {
    title: 'Settings',
    summary: 'Your personal account: profile, password, appearance, notifications, and language - none of this affects other users.',
    tips: [
      'Appearance tab: dark mode, accent color (including a custom color picker), text size, dashboard layout, and landing page.',
      'Notifications tab: mute specific notification types from your bell icon.',
    ],
  },
  '/admin/system': {
    title: 'System',
    summary:
      'Platform administration in one place, organized as tabs: Reminders (MIS-only SMS/Email master toggles), User Accounts, Loan Products, and Activity Logs.',
    tips: [
      'User Accounts: create and manage staff accounts and their roles - a role controls what a staff account can see and do across the whole app, so assign the narrowest one that still lets someone do their job.',
      'Loan Products: read-only product catalog, plus a Product Types sub-tab (MIS-only) to rename how each category is labeled everywhere it appears - the underlying grouping rule stays the same, only the text shown to staff changes.',
      'Activity Logs (MIS-only): a full audit trail of who did what, when, across the whole system - filter by section or search by staff name to trace a specific change.',
      'Reminders (MIS-only): turning a channel on affects every borrower, not just one - only enable once the message content and test sends have been verified.',
    ],
  },
  '/support/about': {
    title: 'About',
    summary: 'App version, changelog, and team credits - not a how-to guide (that\'s this Help panel).',
    tips: [],
  },
};

const DEFAULT_TOPIC: HelpTopic = {
  title: 'Getting Started',
  summary: "This page doesn't have specific guidance yet - here's what's available across the app.",
  tips: ['Use the search bar in the top bar to jump straight to a client, loan, or application by name/code.', 'Click the bell icon for notifications on things needing your attention.'],
};

/** Longest-prefix match against `HELP_TOPICS`' keys (e.g. `/loans/abc-123` matches `/loans`, not
 * `/`) - falls back to `DEFAULT_TOPIC` for a route with no specific guidance yet. */
export function getHelpTopic(pathname: string): HelpTopic {
  const matches = Object.keys(HELP_TOPICS)
    .filter((path) => pathname === path || (path !== '/' && pathname.startsWith(path)))
    .sort((a, b) => b.length - a.length);
  return matches.length > 0 ? HELP_TOPICS[matches[0]!]! : DEFAULT_TOPIC;
}
