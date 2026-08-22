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
import { cn } from '@/lib/utils';

interface ReportEntry {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: 'live' | 'planned';
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
      { to: '/reports/loans', label: 'Loan report', description: 'Loans originated over time', icon: CalendarClock, status: 'live' },
      { to: '/reports/collections', label: 'Collection report', description: 'Amount collected over time', icon: PiggyBank, status: 'live' },
      { to: '/reports/transactions', label: 'Transaction report', description: 'Every ledger entry, filterable', icon: Receipt, status: 'live' },
      {
        to: '/reports/portal-accounts',
        label: 'Portal accounts',
        description: 'Client self-service portal logins',
        icon: Users,
        status: 'live',
      },
    ],
  },
  {
    label: 'Accounting',
    reports: [
      { to: '/reports/aging', label: 'Aging report', description: 'Past due, bucketed by age', icon: BarChart3, status: 'live' },
      {
        to: '/reports/ending-balance',
        label: 'Detailed ending current balance',
        description: 'Per-loan balance snapshot',
        icon: FileSpreadsheet,
        status: 'live',
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
      },
      {
        to: '/reports/collection-history',
        label: 'Collection',
        description: 'Paid-installment history',
        icon: Receipt,
        status: 'live',
      },
      {
        to: '/reports/expected-collection',
        label: 'Expected collection',
        description: 'What should come in and when',
        icon: CalendarCheck,
        status: 'live',
      },
      {
        to: '/reports/first-amortization',
        label: 'First amortization',
        description: 'First installment per loan',
        icon: CalendarClock,
        status: 'live',
      },
      {
        to: '/reports/daily-collection',
        label: 'Daily collection report',
        description: 'Per-day collections, OR#/AR#/channel',
        icon: CalendarCheck,
        status: 'live',
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
      },
      {
        to: '/reports/fully-paid',
        label: 'Fully paid accounts',
        description: 'Loans settled in full',
        icon: CheckSquare,
        status: 'live',
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground">Grouped the same way as the legacy system's own report menu.</p>
      </div>

      {CATEGORIES.map((category) => (
        <div key={category.label} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{category.label}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.reports.map((report) => (
              <ReportCard key={report.to} report={report} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
