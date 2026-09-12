import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronRight, ExternalLink, FilePlus2, Lock, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ReportLoadingProgress } from '@/components/ReportLoadingProgress';
import { RoleAbbr } from '@/components/RoleAbbr';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { STATUS_DISPLAY_LABEL } from '@/lib/loanApplicationStatusLabels';
import { productTypeLabel, useProductTypeLabels } from '@/lib/productTypeLabels';
import { useQuery } from '@tanstack/react-query';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import type { LoanApplication, LoanApplicationStatus } from '@/lib/loanApplicationApiTypes';
import { LoanApplicationEntry } from '@/pages/LoanApplicationCreatePage';
import { formatDate, formatPeso } from '@/lib/utils';

const PAGE_SIZE = 25;

/** Matches LoanApplication.decline()'s own status guard (domain/LoanApplication.ts) - bulk-select
 * only offers rows the backend will actually accept a decline for. Bulk decline was chosen as the
 * one bulk action worth building here (not bulk-approve): approve requires a product sub-type
 * assigned per application first, which isn't uniform across a multi-select, so there's no safe
 * single "Approve Selected" action - decline has no such per-row precondition. */

/** Matches LoanApplicationCreatePage's LOAN_TYPE_OPTIONS exactly - every application's
 * `requestedCategory` comes from that same fixed dropdown, so a static list here (rather than
 * deriving options from whatever categories happen to be on the current fetched page) keeps every
 * option available in the filter regardless of what's actually been paginated in yet. */
const CATEGORY_OPTIONS = ['ALL', 'Business Loan', 'Salary Loan', 'Seafarer Loan'];

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 2026-09-11 (user request): quick presets for the "Submitted" date-range filter below - each
 * returns the [from, to] pair as `<input type="date">`-compatible strings. */
const DATE_RANGE_PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: 'Last 7 days',
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return [toDateInputValue(from), toDateInputValue(to)];
    },
  },
  {
    label: 'This month',
    range: () => {
      const now = new Date();
      return [toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), toDateInputValue(now)];
    },
  },
  {
    label: 'Last month',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return [toDateInputValue(from), toDateInputValue(to)];
    },
  },
];

function applicantInitials(name: string) {
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

/** 2026-09-11 (user request): the "Reason" column's text - DECLINED is a human decision, so its
 * reason is whatever the reviewer typed into `decisionNote` when declining. PREDECLINED is purely
 * system-computed (LoanApplicationPreQualificationService, advisory only - see this type's own doc
 * comment on `preQualificationBreakdown`), so there's no human-entered note for it; the reason is
 * built from whichever check(s) in the breakdown failed instead. Every other status has no
 * "reason" concept at all. */
function declineReason(app: LoanApplication): string | null {
  if (app.status === 'DECLINED') {
    return app.decisionNote?.trim() || null;
  }
  if (app.status === 'PREDECLINED' && app.preQualificationBreakdown) {
    const checks = app.preQualificationBreakdown.checks;
    const failed = [checks.age, checks.income, checks.employment].filter((c): c is NonNullable<typeof c> => Boolean(c) && !c!.passed);
    if (failed.length === 0) return null;
    return failed.map((c) => c.detail || c.label).join('; ');
  }
  return null;
}

function getSortValue(app: LoanApplication, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'applicantName':
      return app.applicantName;
    case 'requestedCategory':
      return app.requestedCategory;
    case 'requestedAmount':
      return app.requestedAmount;
    case 'status':
      return app.status;
    case 'createdAt':
      return new Date(app.createdAt);
    default:
      return undefined;
  }
}

/** 'FOR_DISBURSEMENT' isn't a raw `LoanApplicationStatus` - it's a derived state (an APPROVED
 * application whose loan account has been created but not yet Activated), same as the "For
 * Disbursement" badge shown in the table below. Filtered separately from plain "Approved" so
 * staff can find applications actually waiting on disbursement. */
const STATUS_OPTIONS: { value: LoanApplicationStatus | 'FOR_DISBURSEMENT' | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'INCOMPLETE', label: STATUS_DISPLAY_LABEL.INCOMPLETE },
  { value: 'PREAPPROVED', label: STATUS_DISPLAY_LABEL.PREAPPROVED },
  { value: 'PREDECLINED', label: STATUS_DISPLAY_LABEL.PREDECLINED },
  { value: 'UNDER_REVIEW', label: STATUS_DISPLAY_LABEL.UNDER_REVIEW },
  { value: 'PRE_APPROVAL', label: STATUS_DISPLAY_LABEL.PRE_APPROVAL },
  { value: 'APPROVED', label: STATUS_DISPLAY_LABEL.APPROVED },
  { value: 'FOR_DISBURSEMENT', label: 'For Disbursement' },
  { value: 'DECLINED', label: STATUS_DISPLAY_LABEL.DECLINED },
];

const STATUS_BADGE_VARIANT: Record<LoanApplicationStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  INCOMPLETE: 'warning',
  PREAPPROVED: 'secondary',
  PREDECLINED: 'warning',
  UNDER_REVIEW: 'secondary',
  PRE_APPROVAL: 'secondary',
  APPROVED: 'success',
  DECLINED: 'destructive',
};

/** 2026-09-12 (user request): Debt-to-Income risk triage, computed once at submission - see
 * LoanApplicationRiskAssessmentService on the backend. Separate from STATUS_BADGE_VARIANT/
 * decision status above - this is advisory risk, not a decision outcome, so it gets its own
 * semantic-color scale (green/amber/red for Low/Medium/High) rather than reusing status colors. */
const RISK_TIER_OPTIONS: { value: 'LOW' | 'MEDIUM' | 'HIGH' | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All risk tiers' },
  { value: 'LOW', label: 'Low risk' },
  { value: 'MEDIUM', label: 'Medium risk' },
  { value: 'HIGH', label: 'High risk' },
];

const RISK_TIER_BADGE_CLASS: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  MEDIUM: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  HIGH: 'border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};
const RISK_TIER_LABEL: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
const RISK_TIER_TEXT_CLASS: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'text-emerald-700 dark:text-emerald-400',
  MEDIUM: 'text-amber-700 dark:text-amber-400',
  HIGH: 'text-red-700 dark:text-red-400',
};
const RISK_TIER_DOT_CLASS: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-red-500',
};
/** Scales a DTI% onto a 0-100% bar width - capped visually at 60% DTI so the bar doesn't look
 * nearly-empty for the common <30% case (matches the mockup's own scaling). */
function dtiBarWidth(dtiPercent: number): number {
  return Math.max(4, Math.min(100, (dtiPercent / 60) * 100));
}

interface RiskTierCounts {
  low: number;
  medium: number;
  high: number;
  unscored: number;
  total: number;
}

/**
 * Wired to the real backend Loan Applications module (`GET /loan-applications`). Every application
 * is system-classified PREAPPROVED/PREDECLINED at creation (and re-classified whenever the Detail
 * page's Risk Management Summary is saved) by the backend's LoanApplicationPreQualificationService
 * - advisory only; the officer still makes the real APPROVED/DECLINED call from the Detail page.
 *
 * Real, server-side pagination (25 rows/page - see `useCursorPagination`) so a full page of up to
 * 25 matching rows is always shown, even with a filter applied. Applicant-name search, status, and
 * category (2026-07-16) all go to backend query params - previously status/category only narrowed
 * within whatever page had already been fetched, so a filtered view could show far fewer than 25
 * rows despite more matches existing on later pages. "For Disbursement" is the one exception: it's
 * a derived state, not a raw `status` value, so the server is asked for `status=APPROVED` and the
 * derived narrowing happens client-side on that page only - a smaller, accepted gap versus the
 * general bug this fixes.
 */
export function LoanApplicationsPage() {
  const navigate = useNavigate();
  const { canAccessLoanApplications, currentAccount } = useRole();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = React.useState<LoanApplicationStatus | 'FOR_DISBURSEMENT' | 'ALL'>('ALL');
  const [category, setCategory] = React.useState('ALL');
  const [riskTier, setRiskTier] = React.useState<'LOW' | 'MEDIUM' | 'HIGH' | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  useLogPageView('List of Loan Applications');
  const productTypeLabelsQuery = useProductTypeLabels();

  // 2026-09-12 (user request): risk-summary tiles above the table - branch-scoped only (see
  // GetLoanApplicationRiskSummaryUseCase's own doc comment), so this deliberately does NOT depend
  // on search/status/category/date filter state below - it always reflects the same stable count.
  const riskSummaryQuery = useQuery({
    queryKey: ['loan-applications', 'risk-summary'],
    queryFn: () => apiClient.get<RiskTierCounts>('/loan-applications/risk-summary'),
    enabled: canAccessLoanApplications,
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const {
    items: applications,
    query: applicationsQuery,
    pageNumber,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
  } = useCursorPagination<LoanApplication>(
    ['loan-applications'],
    '/loan-applications',
    {
      search: debouncedSearch,
      status: status === 'ALL' ? undefined : status === 'FOR_DISBURSEMENT' ? 'APPROVED' : status,
      requestedCategory: category === 'ALL' ? undefined : category,
      riskTier: riskTier === 'ALL' ? undefined : riskTier,
      createdAfter: dateFrom || undefined,
      createdBefore: dateTo || undefined,
    },
    PAGE_SIZE,
    canAccessLoanApplications,
  );

  // Which of this page's applications' created loan accounts exist, their status, and loan code -
  // status drives the "For Disbursement"/"Disbursed" relabel (an Approved application whose loan
  // account has been created but not yet Activated shows as "For Disbursement", matching the loan
  // account's own APPROVED-status relabel; once Activated it shows as "Disbursed" instead, mirrors
  // the Loan Application Detail page's own relabel). loanCode (2026-07-20 user request) drives the
  // new "Loan Account" column - the account an approved application actually turned into.
  const loanAccountsQuery = useQuery({
    queryKey: ['loan-accounts', 'all', 'statusOnly'],
    queryFn: () => fetchAllPages<{ id: string; status: string; loanCode: string }>('/loan-accounts'),
    enabled: canAccessLoanApplications,
  });
  const loanAccountById = React.useMemo(
    () => new Map((loanAccountsQuery.data ?? []).map((l) => [l.id, l])),
    [loanAccountsQuery.data],
  );

  // Mirrors the "For Disbursement" badge logic below: an Approved application whose loan account
  // exists but hasn't been Activated yet (still PENDING_APPROVAL/APPROVED on the loan account
  // side).
  const isForDisbursement = React.useCallback(
    (app: LoanApplication) => {
      if (app.status !== 'APPROVED' || !app.createdLoanAccountId) return false;
      const loanAccountStatus = loanAccountById.get(app.createdLoanAccountId)?.status;
      return loanAccountStatus === 'PENDING_APPROVAL' || loanAccountStatus === 'APPROVED';
    },
    [loanAccountById],
  );

  // status and requestedCategory are already server-filtered above (via useCursorPagination's
  // extraParams) - the only remaining client-side narrowing is FOR_DISBURSEMENT, a derived state
  // the server can't filter on directly (it asked for status=APPROVED instead; see this
  // component's own doc comment for why that's a smaller, accepted gap).
  // Computed unconditionally, before the early return below, so
  // useSortableTable's hook call is never skipped on some renders.
  const filtered = status === 'FOR_DISBURSEMENT' ? applications.filter(isForDisbursement) : applications;
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'createdAt', direction: 'desc' });

  if (!canAccessLoanApplications) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">List of Loan Applications</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Restricted to <RoleAbbr role="MIS" />, <RoleAbbr role="Loan Operation Manager" />, and <RoleAbbr role="CRM" /> accounts
            </p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}) - this
              role does not have access to Loan Applications.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = applications.filter(
    (a) =>
      a.status === 'INCOMPLETE' || a.status === 'PREAPPROVED' || a.status === 'PREDECLINED' || a.status === 'UNDER_REVIEW' || a.status === 'PRE_APPROVAL',
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">List of Loan Applications</h2>
          <p className="text-sm text-muted-foreground">
            {applications.length} application{applications.length === 1 ? '' : 's'} on this page ({pendingCount} pending decision) -
            intake, review, and decision workflow, wired to the live backend.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setCreateOpen(true)} title="Encode a walk-in applicant's paper application (Form ECLC-LOFN01)">
          <FilePlus2 className="mr-2 h-4 w-4" /> Create Loan Applicant Profile
        </Button>
      </div>

      {/* 2026-09-12 (user request): at-a-glance Debt-to-Income risk triage - who's Low/Medium/High
          risk, without opening every application. See GetLoanApplicationRiskSummaryUseCase. */}
      {riskSummaryQuery.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <span className="text-xs font-medium text-muted-foreground">Total applications</span>
              <span className="text-2xl font-bold tabular-nums text-primary">{riskSummaryQuery.data.total}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">Low risk</span>
              </div>
              <span className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{riskSummaryQuery.data.low}</span>
              <span className="text-[11px] text-muted-foreground">DTI ≤ 30%</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">Medium risk</span>
              </div>
              <span className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{riskSummaryQuery.data.medium}</span>
              <span className="text-[11px] text-muted-foreground">DTI 31–40%</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-muted-foreground">High risk</span>
              </div>
              <span className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">{riskSummaryQuery.data.high}</span>
              <span className="text-[11px] text-muted-foreground">DTI &gt; 40% — review first</span>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Application Form</DialogTitle>
            <DialogDescription>
              For walk-in applicants - the loan officer fills this out on the applicant&apos;s behalf, following the official paper
              form (Form No. <span className="font-mono">ECLC-LOFN01</span>, Rev 02).
            </DialogDescription>
          </DialogHeader>
          {createOpen && (
            <LoanApplicationEntry
              showChrome={false}
              onCreated={(application, failedDocumentLabels) => {
                setCreateOpen(false);
                navigate(`/applications/${application.id}`, {
                  state: failedDocumentLabels ? { failedDocumentLabels } : undefined,
                });
              }}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {applicationsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load loan applications. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">Search &amp; Filter</CardTitle>
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applicant name..."
                className="w-full pl-8 sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as LoanApplicationStatus | 'FOR_DISBURSEMENT' | 'ALL')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === 'ALL' ? 'All categories' : productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskTier} onValueChange={(v) => setRiskTier(v as 'LOW' | 'MEDIUM' | 'HIGH' | 'ALL')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RISK_TIER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Submitted</span>
            <Input type="date" className="w-auto" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" className="w-auto" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
            <div className="mx-1 h-5 w-px bg-border" />
            {DATE_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full text-xs"
                onClick={() => {
                  const [from, to] = preset.range();
                  setDateFrom(from);
                  setDateTo(to);
                }}
              >
                {preset.label}
              </Button>
            ))}
            {(dateFrom || dateTo) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear dates
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 2026-09-11 (user-reported: adding the Reason column widened the table past the
              viewport, and with no scroll container of its own, the WHOLE page - including the
              Search & Filter header above - scrolled sideways with it. Contained here instead, so
              only the table itself scrolls horizontally if it ever needs to. */}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="applicantName" currentSort={sort} onSort={toggleSort}>
                  Applicant
                </SortableTableHead>
                <SortableTableHead sortKey="requestedCategory" currentSort={sort} onSort={toggleSort}>
                  Category
                </SortableTableHead>
                <SortableTableHead sortKey="requestedAmount" currentSort={sort} onSort={toggleSort} className="text-right">
                  Amount
                </SortableTableHead>
                <TableHead>DTI</TableHead>
                <TableHead>Risk</TableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Decision Status
                </SortableTableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Loan Account</TableHead>
                <SortableTableHead sortKey="createdAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Submitted
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((app) => (
                <React.Fragment key={app.id}>
                <TableRow>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    <div className="flex items-center gap-2">
                      <ApplicantAvatar
                        ownerType="LOAN_APPLICATION"
                        ownerId={app.id}
                        initials={applicantInitials(app.applicantName)}
                        className="h-7 w-7"
                        fallbackClassName="text-xs"
                      />
                      <span>{app.applicantName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    {productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, app.requestedCategory)}
                  </TableCell>
                  <TableCell className="cursor-pointer text-right" onClick={() => navigate(`/applications/${app.id}`)}>
                    {formatPeso(app.requestedAmount)}
                  </TableCell>
                  <TableCell className="min-w-[90px]">
                    {app.dtiPercent !== null ? (
                      <button
                        type="button"
                        className="flex w-full flex-col gap-1 text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(app.id);
                        }}
                        aria-expanded={expandedIds.has(app.id)}
                        aria-label={`Show how ${app.applicantName}'s DTI was computed`}
                      >
                        <span className="font-mono text-sm font-semibold tabular-nums">{app.dtiPercent.toFixed(1)}%</span>
                        <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <span
                            className={`block h-full rounded-full ${app.riskTier ? RISK_TIER_DOT_CLASS[app.riskTier] : 'bg-muted-foreground'}`}
                            style={{ width: `${dtiBarWidth(app.dtiPercent)}%` }}
                          />
                        </span>
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {app.riskTier ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(app.id);
                        }}
                        aria-expanded={expandedIds.has(app.id)}
                        aria-label={`Show how ${app.applicantName}'s DTI was computed`}
                      >
                        <Badge className={`gap-1.5 ${RISK_TIER_BADGE_CLASS[app.riskTier]}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${RISK_TIER_DOT_CLASS[app.riskTier]}`} />
                          {RISK_TIER_LABEL[app.riskTier]}
                        </Badge>
                        {expandedIds.has(app.id) ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    {/* Waits for loanAccountsQuery before showing For Disbursement/Disbursed for an
                        application with a created loan account - otherwise this briefly flashes
                        "Approved" (the raw application status) before flipping to the resolved
                        label once the loan accounts list finishes loading a moment later. */}
                    {app.status === 'APPROVED' && app.createdLoanAccountId && loanAccountsQuery.isLoading ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        …
                      </Badge>
                    ) : (
                      (() => {
                        const loanAccountStatus = app.createdLoanAccountId ? loanAccountById.get(app.createdLoanAccountId)?.status : undefined;
                        if (app.status === 'APPROVED' && loanAccountStatus) {
                          const isActivated = loanAccountStatus !== 'PENDING_APPROVAL' && loanAccountStatus !== 'APPROVED';
                          return <Badge variant="success">{isActivated ? 'Disbursed' : 'For Disbursement'}</Badge>;
                        }
                        return <Badge variant={STATUS_BADGE_VARIANT[app.status]}>{STATUS_DISPLAY_LABEL[app.status]}</Badge>;
                      })()
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] cursor-pointer whitespace-normal break-words text-xs text-muted-foreground" onClick={() => navigate(`/applications/${app.id}`)}>
                    {declineReason(app) ?? '—'}
                  </TableCell>
                  <TableCell>
                    {app.createdLoanAccountId ? (
                      <Link
                        to={`/loans/${app.createdLoanAccountId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                      >
                        {loanAccountById.get(app.createdLoanAccountId)?.loanCode ?? app.createdLoanAccountId}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer text-xs text-muted-foreground"
                    onClick={() => navigate(`/applications/${app.id}`)}
                  >
                    {formatDate(app.createdAt)}
                  </TableCell>
                </TableRow>
                {expandedIds.has(app.id) && app.riskTier && app.dtiPercent !== null && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={9} className="py-4">
                      {/* 2026-09-12 (user request): "no black-box numbers" - every DTI figure traces
                          back to something on the application. Amortization comes straight from
                          preQualificationBreakdown (same value the system's own pre-qualification
                          check uses), never re-derived here with a duplicated flat-rate constant. */}
                      <div className="max-w-2xl pl-10">
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9.5px] text-primary-foreground">1</span>
                          Estimated monthly amortization
                        </div>
                        <div className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
                          <div>
                            <div className="text-muted-foreground">Requested loan amount</div>
                            <div className="font-mono font-semibold tabular-nums">{formatPeso(app.requestedAmount)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Requested term</div>
                            <div className="font-mono font-semibold tabular-nums">{app.requestedTermMonths} months</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Category</div>
                            <div className="font-mono font-semibold">{productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, app.requestedCategory)}</div>
                          </div>
                        </div>
                        {app.preQualificationBreakdown && (
                          <div className="mt-2 font-mono text-xs text-muted-foreground">
                            = <span className="font-sans text-sm font-bold text-foreground">{formatPeso(app.preQualificationBreakdown.estimatedMonthlyAmortization)} / mo</span>
                          </div>
                        )}

                        <div className="mb-2 mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9.5px] text-primary-foreground">2</span>
                          Debt-to-income
                        </div>
                        <div className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
                          <div>
                            <div className="text-muted-foreground">Declared monthly income</div>
                            <div className="font-mono font-semibold tabular-nums">{app.monthlyIncome !== null ? formatPeso(app.monthlyIncome) : '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">New loan amortization (step 1)</div>
                            <div className="font-mono font-semibold tabular-nums">
                              {app.preQualificationBreakdown ? formatPeso(app.preQualificationBreakdown.estimatedMonthlyAmortization) : '—'}
                            </div>
                          </div>
                        </div>
                        {app.preQualificationBreakdown && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-3 font-mono text-xs text-muted-foreground">
                            <span>
                              {formatPeso(app.preQualificationBreakdown.estimatedMonthlyAmortization)} ÷ {formatPeso(app.monthlyIncome ?? 0)} × 100
                            </span>
                            <span>=</span>
                            <span className={`font-sans text-sm font-bold ${RISK_TIER_TEXT_CLASS[app.riskTier]}`}>
                              {app.dtiPercent.toFixed(1)}% DTI → {RISK_TIER_LABEL[app.riskTier]} risk
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8">
                    {applicationsQuery.isLoading ? (
                      <ReportLoadingProgress stages={['Fetching applications', 'Resolving statuses']} />
                    ) : (
                      <p className="text-center text-sm text-muted-foreground">No applications match your search/filter.</p>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <PaginationControls
            pageNumber={pageNumber}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onNext={goNext}
            onPrev={goPrev}
            pageSize={PAGE_SIZE}
            itemCount={applications.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel label="List of Loan Applications" entityTypes={['LoanApplication', 'Loan Applications']} />
    </div>
  );
}
