import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileSpreadsheet,
  Receipt,
  CalendarClock,
  PiggyBank,
  ListChecks,
  CalendarCheck,
  CheckSquare,
  MessageSquare,
  FileSignature,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLogPageView } from '@/lib/activityLog';
import { useRole, type PermissionCode } from '@/lib/roleContext';
import { cn } from '@/lib/utils';

interface ReportEntry {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: 'live' | 'planned';
  /** 2026-08-22 (user request): gates whether this card shows at all - each report now has its
   * own permission code instead of one blanket `report.view` (see reportingRouter.ts's doc
   * comment). Omitted for Reminder Logs/E-signature Logs - those routes have no permission gate
   * at all yet, deliberately out of scope for this change, so they stay always-visible like
   * before. */
  permission?: PermissionCode;
}

interface ReportCategory {
  label: string;
  reports: ReportEntry[];
}

/**
 * Categories mirror the legacy system's own report menu structure, discovered by inspecting the
 * 11 real legacy `.xlsx` samples (`docs/SESSION_LOG_2026-07-15.md`, Report Generation section).
 * "General" holds the three report pages that predate that discovery (built independently, not
 * 1:1 replacements of a specific legacy file) - kept distinct rather than force-fit into
 * Accounting/Collection/Operation.
 */
const CATEGORIES: ReportCategory[] = [
  {
    label: 'General',
    reports: [
      {
        to: '/reports/loans',
        label: 'Loan report',
        description: 'Loans originated over time',
        icon: CalendarClock,
        status: 'live',
        permission: 'report.loan_origination.view',
      },
      {
        to: '/reports/collections',
        label: 'Collection report',
        description: 'Amount collected over time',
        icon: PiggyBank,
        status: 'live',
        permission: 'report.collections.view',
      },
      {
        to: '/reports/transactions',
        label: 'Transaction report',
        description: 'Every ledger entry, filterable',
        icon: Receipt,
        status: 'live',
        permission: 'report.transactions.view',
      },
      {
        to: '/reports/portal-accounts',
        label: 'Portal accounts',
        description: 'Client self-service portal logins',
        icon: Users,
        status: 'live',
        permission: 'report.portal_accounts.view',
      },
      {
        to: '/reports/cic-monthly',
        label: 'CIC monthly report',
        description: 'Credit Information Corporation submission file',
        icon: FileSpreadsheet,
        status: 'live',
        permission: 'report.cic_monthly.view',
      },
    ],
  },
  {
    label: 'Accounting',
    reports: [
      {
        to: '/reports/aging',
        label: 'Aging report',
        description: 'Past due, bucketed by age',
        icon: BarChart3,
        status: 'live',
        permission: 'report.aging.view',
      },
      {
        to: '/reports/ending-balance',
        label: 'Detailed ending current balance',
        description: 'Per-loan balance snapshot',
        icon: FileSpreadsheet,
        status: 'live',
        permission: 'report.ending_balance.view',
      },
    ],
  },
  {
    label: 'Collection',
    reports: [
      {
        to: '/reports/accounts-past-due',
        label: 'Accounts with past due',
        description: 'Currently overdue accounts',
        icon: ListChecks,
        status: 'live',
        permission: 'report.accounts_past_due.view',
      },
      {
        to: '/reports/collection-history',
        label: 'Collection',
        description: 'Paid-installment history',
        icon: Receipt,
        status: 'live',
        permission: 'report.collection_history.view',
      },
      {
        to: '/reports/expected-collection',
        label: 'Expected collection',
        description: 'What should come in and when',
        icon: CalendarCheck,
        status: 'live',
        permission: 'report.expected_collection.view',
      },
      {
        to: '/reports/first-amortization',
        label: 'First amortization',
        description: 'First installment per loan',
        icon: CalendarClock,
        status: 'live',
        permission: 'report.first_amortization.view',
      },
      {
        to: '/reports/daily-collection',
        label: 'Daily collection report',
        description: 'Per-day collections, OR#/AR#/channel',
        icon: CalendarCheck,
        status: 'live',
        permission: 'report.daily_collection.view',
      },
    ],
  },
  {
    label: 'Operation',
    reports: [
      {
        to: '/reports/loan-releases',
        label: 'Loan releases report',
        description: 'Every disbursed loan, one row per loan',
        icon: FileSpreadsheet,
        status: 'live',
        permission: 'report.loan_releases.view',
      },
      {
        to: '/reports/fully-paid',
        label: 'Fully paid accounts',
        description: 'Loans settled in full',
        icon: CheckSquare,
        status: 'live',
        permission: 'report.fully_paid.view',
      },
      {
        to: '/reports/reminder-logs',
        label: 'Reminder logs',
        description: 'Who got reminded, by SMS or email, when, status',
        icon: MessageSquare,
        status: 'live',
      },
      {
        to: '/reports/esignature-logs',
        label: 'E-signature logs',
        description: 'Every signing link and OTP code sent, by SMS or email',
        icon: FileSignature,
        status: 'live',
      },
    ],
  },
];

function ReportCard({ report }: { report: ReportEntry }) {
  const Icon = report.icon;
  const content = (
    <>
      <div className="flex items-start justify-between">
        <Icon className="h-5 w-5 text-primary" />
        {report.status === 'planned' && (
          <Badge variant="secondary" className="text-[10px]">
            Coming soon
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm font-medium">{report.label}</p>
      <p className="text-xs text-muted-foreground">{report.description}</p>
    </>
  );

  const cardClass = cn(
    'block rounded-xl border bg-card p-3.5 transition-colors shadow-[0_1px_2px_rgba(20,22,26,0.04),0_4px_10px_rgba(20,22,26,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.35)]',
    report.status === 'live' ? 'hover:border-primary/60 hover:bg-secondary/40' : 'cursor-default opacity-60',
  );

  if (report.status === 'planned') {
    return <div className={cardClass}>{content}</div>;
  }
  return (
    <Link to={report.to} className={cardClass}>
      {content}
    </Link>
  );
}

export function ReportsHubPage() {
  useLogPageView('Reports');
  const { hasPermission } = useRole();

  // 2026-08-22 (user request): each card is now gated by its own permission code instead of one
  // blanket `report.view` - a report the current user isn't granted simply doesn't appear, rather
  // than showing a card that 403s on click. Reminder Logs/E-signature Logs have no `permission`
  // set (see ReportEntry's own doc comment) so they're always shown, unchanged from before.
  const visibleCategories = CATEGORIES.map((category) => ({
    ...category,
    reports: category.reports.filter((report) => !report.permission || hasPermission(report.permission)),
  })).filter((category) => category.reports.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground">Grouped the same way as the legacy system's own report menu.</p>
      </div>

      {visibleCategories.length === 0 ? (
        <p className="text-sm text-muted-foreground">You don't have access to any reports yet. Ask an MIS administrator to grant access.</p>
      ) : (
        visibleCategories.map((category) => (
          <div key={category.label} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">{category.label}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.reports.map((report) => (
                <ReportCard key={report.to} report={report} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
