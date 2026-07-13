import * as React from 'react';
import type { ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Filter,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { LoanPortfolioVennDiagram, type PortfolioHealthSegment } from '@/components/LoanPortfolioVennDiagram';
import { LoanDrillDownDialog, type LoanDrillDown } from '@/components/LoanDrillDownDialog';
import { TermTip } from '@/components/TermTip';
import { FINANCIAL_GLOSSARY } from '@/lib/financialGlossary';
import { useLogPageView } from '@/lib/activityLog';
import { useLanguage } from '@/lib/languageContext';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import type { DashboardSummary } from '@/lib/dashboardApiTypes';
import type { Borrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';
import { cn, formatPeso, pesoTooltipFormatter } from '@/lib/utils';

/**
 * Placeholder pending a business decision on how a real monthly collection target gets set (no
 * target-setting feature exists yet - see docs/SESSION_LOG_2026-07-12.md Addendum 3/4). Only the
 * `target` line below is fabricated; the `actual` line this feeds (`scaledCollectionsVsTarget`)
 * is a real, disclosed-as-estimated figure derived from `GET /dashboard/summary`. Deliberately
 * inlined here (not in a shared "mock data" module) since this is the one remaining placeholder
 * left after 2026-07-12's mock-removal pass - moving it would suggest more sample data exists
 * than actually does.
 */
const COLLECTIONS_VS_TARGET: { month: string; target: number; actual: number }[] = [
  { month: 'Feb', target: 1_128_140, actual: 1_057_320 },
  { month: 'Mar', target: 1_119_870, actual: 993_450 },
  { month: 'Apr', target: 1_134_220, actual: 1_142_680 },
  { month: 'May', target: 1_108_960, actual: 1_021_390 },
  { month: 'Jun', target: 1_126_500, actual: 1_088_710 },
  { month: 'Jul', target: 1_121_330, actual: 1_004_260 },
];

/** Loan row shape every portfolio widget below reads - assembled once from the real `GET
 * /loan-accounts` + `/borrowers` + `/loan-products` responses (see `useDashboardPortfolio`). */
interface PortfolioLoanRow {
  id: string;
  loanCode: string;
  borrowerName: string;
  /** Real product name (e.g. "SML-Regular") - shown in the drill-down dialog's Product column. */
  productType: string;
  /** Product family grouping derived from `productType` (Seafarer Loan / Salary Loan / Business Loan / Other) - used for Portfolio Breakdown. */
  category: string;
  status: LoanAccountStatus;
  principalAmount: number;
  collectionsBalance: number;
  activatedAt: string | null;
  createdAt: string;
  interestPaid: number;
  interestBalance: number;
  penaltyPaid: number;
  penaltyBalance: number;
  principalBalance: number;
}

/** `LoanAccountStatus` (`loanApiTypes.ts`, 7 values) has no distinct `MATURED` status —
 * `ACTIVE`/`ACTIVE_IN_ARREARS` are the only "still active and collecting" states. "Matured" (a
 * loan whose full term is over but still unpaid — `buildRealPortfolioHealth` below) is derived
 * from `/dashboard/summary`'s live `maturedLoanAccountIds`, not from status. */
const REAL_ACTIVE_STATUSES: LoanAccountStatus[] = ['ACTIVE', 'ACTIVE_IN_ARREARS'];

/** Same product-family grouping already approved for the mock dashboard (see the historical
 * `getDashboardLoanCategory` in `mockData.ts`) - every SML-* product is a Seafarer Loan sub-class,
 * SL-* is Salary Loan, BL-* is Business Loan, everything else (PFL/REL/CL/OFW/...) is legacy.
 * Confirmed against the real `loan_products.name` values in the migrated database. */
function categorizeProductName(productName: string): string {
  if (productName.startsWith('Seafarer Loan') || productName.startsWith('SML')) return 'Seafarer Loan';
  if (productName.startsWith('Salary Loan') || /^SL[-_ ]/.test(productName)) return 'Salary Loan';
  if (productName.startsWith('Business Loan') || /^BL[-_ ]/.test(productName)) return 'Business Loan';
  return 'Other (Legacy)';
}

/**
 * 2026-07-12: `overdueLoanIds`/`maturedLoanIds` (from `/dashboard/summary`'s live-computed sets,
 * not `LoanAccount.status`) decide the good/arrears/matured split — `status ===
 * 'ACTIVE_IN_ARREARS'` alone undercounts (nothing in this codebase ever transitions a loan into
 * that status going forward, so it only reflects whatever the legacy migration happened to
 * pre-set) and can't un-flag a loan that's since been paid current. `status` here is only used to
 * confirm a loan is still open (ACTIVE or ACTIVE_IN_ARREARS), not to decide which bucket it falls
 * into. `maturedLoanIds` is always a subset of `overdueLoanIds` — a loan whose final installment
 * is unpaid past its own due date is, by definition, also overdue.
 */
function buildRealPortfolioHealth(loans: PortfolioLoanRow[], overdueLoanIds: ReadonlySet<string>, maturedLoanIds: ReadonlySet<string>) {
  const openLoans = loans.filter((l) => REAL_ACTIVE_STATUSES.includes(l.status));
  const matured = openLoans.filter((l) => maturedLoanIds.has(l.id));
  const arrears = openLoans.filter((l) => overdueLoanIds.has(l.id) && !maturedLoanIds.has(l.id));
  const good = openLoans.filter((l) => !overdueLoanIds.has(l.id));
  const writtenOff = loans.filter((l) => l.status === 'CLOSED_WRITTEN_OFF');
  const sum = (rows: PortfolioLoanRow[], pick: (l: PortfolioLoanRow) => number) =>
    Math.round(rows.reduce((total, l) => total + pick(l), 0) * 100) / 100;
  return {
    good: { count: good.length, collectionsBalance: sum(good, (l) => l.collectionsBalance), interestIncome: sum(good, (l) => l.interestPaid), loans: good },
    activeInArrears: {
      count: arrears.length,
      collectionsBalance: sum(arrears, (l) => l.collectionsBalance),
      penaltyIncome: sum(arrears, (l) => l.penaltyPaid + l.penaltyBalance),
      accruedRevenue: sum(arrears, (l) => l.interestBalance),
      loans: arrears,
    },
    matured: {
      count: matured.length,
      collectionsBalance: sum(matured, (l) => l.collectionsBalance),
      creditLoss: sum(matured, (l) => l.principalBalance),
      loans: matured,
    },
    writtenOff: { count: writtenOff.length, collectionsBalance: sum(writtenOff, (l) => l.collectionsBalance), loans: writtenOff },
  };
}

interface PortfolioCategorySlice {
  category: string;
  value: number;
  loans: PortfolioLoanRow[];
}

function buildRealPortfolioByCategory(loans: PortfolioLoanRow[]): PortfolioCategorySlice[] {
  const byCategory = new Map<string, PortfolioCategorySlice>();
  for (const loan of loans) {
    if (!REAL_ACTIVE_STATUSES.includes(loan.status)) continue;
    const slice = byCategory.get(loan.category) ?? { category: loan.category, value: 0, loans: [] };
    slice.value = Math.round((slice.value + loan.principalBalance) * 100) / 100;
    slice.loans.push(loan);
    byCategory.set(loan.category, slice);
  }
  return [...byCategory.values()];
}

function buildRealQualityMetrics(loans: PortfolioLoanRow[], overdueLoanIds: ReadonlySet<string>, maturedLoanIds: ReadonlySet<string>) {
  const health = buildRealPortfolioHealth(loans, overdueLoanIds, maturedLoanIds);
  const delinquentLoans = [...health.activeInArrears.loans, ...health.matured.loans];
  const activePortfolio = [...health.good.loans, ...delinquentLoans];
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalOutstanding = activePortfolio.reduce((sum, l) => sum + l.collectionsBalance, 0);
  const delinquentOutstanding = delinquentLoans.reduce((sum, l) => sum + l.collectionsBalance, 0);
  return {
    delinquencyRatePercent: activePortfolio.length === 0 ? 0 : round2((delinquentLoans.length / activePortfolio.length) * 100),
    portfolioAtRiskPercent: totalOutstanding === 0 ? 0 : round2((delinquentOutstanding / totalOutstanding) * 100),
    averageLoanSize:
      activePortfolio.length === 0 ? 0 : round2(activePortfolio.reduce((sum, l) => sum + l.principalAmount, 0) / activePortfolio.length),
    writtenOffExposure: health.writtenOff.loans.reduce((sum, l) => sum + l.collectionsBalance, 0),
  };
}

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildRealDisbursementTrend(loans: PortfolioLoanRow[], monthsBack = 6) {
  const now = new Date();
  const buckets: { month: string; year: number; monthIndex: number; disbursed: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let disbursed = 0;
    for (const loan of loans) {
      if (!loan.activatedAt) continue;
      const activated = new Date(loan.activatedAt);
      if (activated.getFullYear() === target.getFullYear() && activated.getMonth() === target.getMonth()) {
        disbursed += loan.principalAmount;
      }
    }
    buckets.push({ month: MONTH_SHORT_NAMES[target.getMonth()]!, year: target.getFullYear(), monthIndex: target.getMonth(), disbursed: Math.round(disbursed * 100) / 100 });
  }
  return buckets;
}

// Deliberately excludes --chart-1: that variable is re-themed per the LMS Configuration
// accent color (emerald/violet/amber/rose) and can collide with one of the other fixed
// chart hues (e.g. the default emerald accent looks identical to --chart-3's green). These
// four stay fixed across every accent theme, so categories are always visually distinct.
const CHART_COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// Recharts' <Tooltip> defaults to a plain white box, which stays white in dark mode too - reads
// as a jarring, low-contrast flash against the rest of the (theme-aware) dashboard. Pulling from
// the same CSS variables as the surrounding cards keeps it in sync with light/dark mode and the
// active accent theme.
const TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.15)',
};
const TOOLTIP_LABEL_STYLE: React.CSSProperties = { color: 'hsl(var(--popover-foreground))', fontWeight: 600, marginBottom: 4 };

const round2Peso = (value: number) => Math.round(value * 100) / 100;

const VENN_SEGMENT_META: Record<PortfolioHealthSegment, { title: string; description: string }> = {
  good: {
    title: 'Good Loan Accounts',
    description: 'ACTIVE accounts paying on schedule, with no penalty fees.',
  },
  activeInArrears: {
    title: 'Active Accounts in Arrears',
    description:
      'Still active and paying, just sometimes late - the segment where Easycash earns penalty/late-fee income on top of amortization.',
  },
  matured: {
    title: 'Matured Loan Accounts',
    description:
      'Active accounts past their full maturity date but still unpaid, with an outstanding balance - the highest-risk active segment (distinct from a settled Closed loan).',
  },
};

const PORTFOLIO_HEALTH_PLANS: {
  key: string;
  title: string;
  segment: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  badgeVariant: BadgeProps['variant'];
  body: string;
}[] = [
  {
    key: 'good',
    title: 'Maintain',
    segment: 'Good accounts',
    icon: ShieldCheck,
    iconClass: 'text-success',
    badgeVariant: 'success',
    body:
      'These borrowers pay on schedule with no penalty history. Keep servicing simple - reminders on the standard schedule, no manual follow-up - and prioritize them for renewal/repeat-loan offers first.',
  },
  {
    key: 'activeInArrears',
    title: 'Protect the margin',
    segment: 'Accounts in Arrears',
    icon: Sparkles,
    iconClass: 'text-warning',
    badgeVariant: 'warning',
    body:
      'Still active and still paying, just sometimes late - the penalty/late-fee income here is real, confirmed revenue on top of amortization. Keep the reminder cadence that nudges them back on time, but avoid over-aggressive collection tactics that could push a paying borrower into default and remove this income entirely.',
  },
  {
    key: 'matured',
    title: 'Resolve',
    segment: 'Matured accounts',
    icon: AlertTriangle,
    iconClass: 'text-destructive',
    badgeVariant: 'destructive',
    body:
      'These loans have run past their full maturity date and are still unpaid - the highest-risk active segment, one step short of write-off. Escalate to intensive collection, and evaluate restructuring or a formal repayment plan to bring the balance back into a payable schedule before the loss is realized. Distinct from a settled Closed loan, which needs no action.',
  },
];

function SummaryCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  onClick,
  trend,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'destructive';
  onClick?: () => void;
  /** 2026-07-12: rolling 30-day (Total Active Loans) / vs-last-month (Collections) — omitted entirely, not shown as "0%", when the backend can't compute a reliable baseline (`changePercent: null`, e.g. Overdue Accounts, or a zero previous-period baseline). */
  trend?: { changePercent: number | null; label: string };
}) {
  return (
    <Card
      className={onClick ? 'cursor-pointer transition-colors hover:border-primary/60' : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={onClick ? 'View the loan accounts behind this figure' : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={tone === 'destructive' ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-primary'} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend && trend.changePercent !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                trend.changePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {trend.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.changePercent).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        {trend && trend.changePercent !== null && <p className="text-[11px] text-muted-foreground">{trend.label}</p>}
      </CardContent>
    </Card>
  );
}

function MetricItem({
  term,
  definition,
  value,
  onClick,
}: {
  term: string;
  definition: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {term}
        <TermTip term={term} definition={definition} />
      </p>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-1 text-xl font-bold text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
          title="View the loan accounts behind this figure"
        >
          {value}
        </button>
      ) : (
        <p className="mt-1 text-xl font-bold">{value}</p>
      )}
    </div>
  );
}

const ALL_CATEGORIES = 'ALL';
const EMPTY_DATE_RANGE: DateRange = { from: '', to: '' };

export function DashboardPage() {
  useLogPageView('Dashboard');
  const { t } = useLanguage();
  const [drillDown, setDrillDown] = React.useState<LoanDrillDown | null>(null);

  // Live portfolio-wide totals from the real backend (GET /dashboard/summary) - backs the three
  // Overview cards while the Portfolio Filter is at its default (ALL_CATEGORIES, no date range).
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiClient.get<DashboardSummary>('/dashboard/summary'),
  });

  // Full portfolio, fetched once and aggregated client-side - same pattern LoanListPage already
  // uses for the borrower/product name join. Every filterable card below (Quality Metrics,
  // Disbursement Trend, Portfolio Breakdown, Portfolio Health, and every drill-down) reacts to
  // this, replacing the former MOCK_LOANS-driven versions.
  const loanAccountsQuery = useQuery({ queryKey: ['loan-accounts', 'all'], queryFn: () => fetchAllPages<LoanAccount>('/loan-accounts') });
  const borrowersQuery = useQuery({ queryKey: ['borrowers', 'all'], queryFn: () => fetchAllPages<Borrower>('/borrowers') });
  const productsQuery = useQuery({
    // Deliberately NOT ['loan-products', 'all'] - that key is shared by pages caching the plain
    // LoanProduct[] array; this query's Map shape crashed them on cross-page navigation
    // (`(productsQuery.data ?? []).flatMap is not a function`). See ClientProfilePage.tsx's
    // identical fix for the full explanation.
    queryKey: ['loan-products', 'all', 'versionToProductNameMap'],
    queryFn: async () => {
      const products = await fetchAllPages<LoanProduct>('/loan-products');
      const versionToProductName = new Map<string, string>();
      for (const p of products) {
        for (const v of p.versions ?? []) versionToProductName.set(v.id, p.name);
      }
      return versionToProductName;
    },
  });

  const isPortfolioLoading = loanAccountsQuery.isLoading || borrowersQuery.isLoading || productsQuery.isLoading;

  const allPortfolioLoans: PortfolioLoanRow[] = React.useMemo(() => {
    if (!loanAccountsQuery.data) return [];
    const borrowerById = new Map((borrowersQuery.data ?? []).map((b) => [b.id, b]));
    const versionToProductName = productsQuery.data ?? new Map<string, string>();
    return loanAccountsQuery.data.map((l): PortfolioLoanRow => {
      const borrower = borrowerById.get(l.borrowerId);
      const productName = versionToProductName.get(l.loanProductVersionId) ?? '-';
      return {
        id: l.id,
        loanCode: l.loanCode,
        borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : l.borrowerId,
        productType: productName,
        category: categorizeProductName(productName),
        status: l.status,
        principalAmount: Number.parseFloat(l.principalAmount) || 0,
        collectionsBalance: Number.parseFloat(l.collectionsBalance) || 0,
        activatedAt: l.activatedAt,
        createdAt: l.createdAt,
        interestPaid: Number.parseFloat(l.balances.interestPaid) || 0,
        interestBalance: Number.parseFloat(l.balances.interestBalance) || 0,
        penaltyPaid: Number.parseFloat(l.balances.penaltyPaid) || 0,
        penaltyBalance: Number.parseFloat(l.balances.penaltyBalance) || 0,
        principalBalance: Number.parseFloat(l.balances.principalBalance) || 0,
      };
    });
  }, [loanAccountsQuery.data, borrowersQuery.data, productsQuery.data]);

  const loanCategoryOptions = React.useMemo(
    () => [...new Set(buildRealPortfolioByCategory(allPortfolioLoans).map((s) => s.category))].sort(),
    [allPortfolioLoans],
  );

  // Portfolio Filter - the master filter for the whole Dashboard (loan category + origination
  // date range). Every portfolio card below (Overview summary cards, Quality Metrics, Loan
  // Disbursement Trend, Collections vs. Target, Portfolio Breakdown, Loan Portfolio Health) reacts
  // to it. Two cards are deliberately exempt, by design, not oversight: Collections Forecast
  // (a bottom-up projection from each active loan's own fixed repayment schedule - filtering it
  // by category/date would just be a different, narrower forecast, not a clearer one, and the
  // point of a portfolio-wide cash-flow forecast is to answer "how much is coming in overall") and
  // Recommendation (portfolio-wide strategic guidance, not a report figure).
  const [categoryFilter, setCategoryFilter] = React.useState<string>(ALL_CATEGORIES);
  const [dateRange, setDateRange] = React.useState<DateRange>(EMPTY_DATE_RANGE);
  const isFiltered = categoryFilter !== ALL_CATEGORIES || dateRange.from !== '' || dateRange.to !== '';
  const resetFilters = () => {
    setCategoryFilter(ALL_CATEGORIES);
    setDateRange(EMPTY_DATE_RANGE);
  };

  const portfolioFilteredLoans = React.useMemo(() => {
    const fromTime = dateRange.from ? new Date(dateRange.from).getTime() : null;
    const toTime = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`).getTime() : null;
    return allPortfolioLoans.filter((loan) => {
      if (categoryFilter !== ALL_CATEGORIES && loan.category !== categoryFilter) return false;
      const originated = new Date(loan.createdAt).getTime();
      if (fromTime !== null && originated < fromTime) return false;
      if (toTime !== null && originated > toTime) return false;
      return true;
    });
  }, [allPortfolioLoans, categoryFilter, dateRange]);

  // Independent of the Portfolio Filter / isFiltered gate below (unlike liveSummary) — the
  // good/arrears/matured split needs these live id sets no matter what the user has filtered to.
  const overdueLoanIds = React.useMemo(() => new Set(summaryQuery.data?.overdueAccounts.loanAccountIds ?? []), [summaryQuery.data]);
  const maturedLoanIds = React.useMemo(() => new Set(summaryQuery.data?.overdueAccounts.maturedLoanAccountIds ?? []), [summaryQuery.data]);

  const filteredPortfolioHealth = React.useMemo(
    () => buildRealPortfolioHealth(portfolioFilteredLoans, overdueLoanIds, maturedLoanIds),
    [portfolioFilteredLoans, overdueLoanIds, maturedLoanIds],
  );
  const filteredPortfolioByCategory = React.useMemo(
    () => buildRealPortfolioByCategory(portfolioFilteredLoans),
    [portfolioFilteredLoans],
  );
  const filteredQualityMetrics = React.useMemo(
    () => buildRealQualityMetrics(portfolioFilteredLoans, overdueLoanIds, maturedLoanIds),
    [portfolioFilteredLoans, overdueLoanIds, maturedLoanIds],
  );
  const filteredDisbursementTrend = React.useMemo(
    () => buildRealDisbursementTrend(portfolioFilteredLoans, 6),
    [portfolioFilteredLoans],
  );
  const liveSummary = !isFiltered ? summaryQuery.data : undefined;
  const filteredActiveCount =
    filteredPortfolioHealth.good.count + filteredPortfolioHealth.activeInArrears.count + filteredPortfolioHealth.matured.count;
  const filteredOutstandingTotal =
    filteredPortfolioByCategory.reduce((sum, slice) => sum + slice.value, 0) ||
    filteredPortfolioHealth.good.collectionsBalance +
      filteredPortfolioHealth.activeInArrears.collectionsBalance +
      filteredPortfolioHealth.matured.collectionsBalance;

  // Every active loan under the current filter (performing, in arrears, and past-maturity-but-
  // unpaid) - the denominator/drill-down set behind the filtered Total Active Loans and Average
  // Loan Size figures.
  const filteredActivePortfolioLoans = React.useMemo(
    () => [...filteredPortfolioHealth.good.loans, ...filteredPortfolioHealth.activeInArrears.loans, ...filteredPortfolioHealth.matured.loans],
    [filteredPortfolioHealth],
  );

  // Delinquent = overdue but still active: in arrears (overdue within term) + matured (past the
  // full term, still unpaid). This is the numerator behind the Delinquency Rate and PAR metrics.
  const filteredDelinquentLoans = React.useMemo(
    () => [...filteredPortfolioHealth.activeInArrears.loans, ...filteredPortfolioHealth.matured.loans],
    [filteredPortfolioHealth],
  );

  // Collections This Month and Collections vs. Target have no per-loan, per-calendar-month payment
  // date available to sum bottom-up (see the Collections Forecast doc comment below for why the
  // Forecast card *can* do this and these two can't). Scaled proportionally to how much of the
  // whole portfolio's outstanding principal the current filter selects, off the real, unfiltered
  // Collections This Month total from `GET /dashboard/summary` - an honest estimate derived from
  // real numbers, clearly disclosed as such, not a fabricated figure.
  const totalPortfolioValue = React.useMemo(
    () => allPortfolioLoans.filter((l) => REAL_ACTIVE_STATUSES.includes(l.status)).reduce((sum, l) => sum + l.principalBalance, 0),
    [allPortfolioLoans],
  );
  const filterRatio = totalPortfolioValue > 0 ? filteredOutstandingTotal / totalPortfolioValue : 1;
  const scaledCollectionsThisMonth = round2Peso(Number(summaryQuery.data?.collectionsThisMonth.amount ?? 0) * filterRatio);
  const scaledCollectionsVsTarget = React.useMemo(
    () =>
      COLLECTIONS_VS_TARGET.map((m) => ({
        month: m.month,
        target: round2Peso(m.target * filterRatio),
        actual: round2Peso(m.actual * filterRatio),
      })),
    [filterRatio],
  );

  const openDelinquentAccounts = () =>
    setDrillDown({
      title: 'Delinquent Accounts',
      description:
        'Overdue but still active - accounts in arrears (overdue within term) plus matured accounts (past the full term, still unpaid). This is the set behind the Delinquency Rate and Portfolio-at-Risk figures.' +
        (isFiltered ? ' Reflects the Portfolio Filter above.' : ''),
      loans: filteredDelinquentLoans,
    });

  const openVennSegment = (segment: PortfolioHealthSegment) =>
    setDrillDown({ ...VENN_SEGMENT_META[segment], loans: filteredPortfolioHealth[segment].loans });

  const openCategorySlice = (slice: PortfolioCategorySlice) =>
    setDrillDown({
      title: `${slice.category} - Active Portfolio`,
      description: `Still-active loan accounts (active, in arrears, or matured) under the ${slice.category} category (${formatPeso(slice.value)} outstanding principal). SML products roll up under Seafarer Loan.${isFiltered ? ' Reflects the Portfolio Filter above.' : ''}`,
      loans: slice.loans,
    });

  const openDisbursementMonth = (bucket: { month: string; year: number; monthIndex: number }) => {
    const loans = portfolioFilteredLoans.filter((l) => {
      if (!l.activatedAt) return false;
      const activated = new Date(l.activatedAt);
      return activated.getMonth() === bucket.monthIndex && activated.getFullYear() === bucket.year;
    });
    setDrillDown({
      title: `Loans activated in ${bucket.month} ${bucket.year}`,
      description:
        'The loan accounts whose activation date falls in the selected month.' +
        (isFiltered ? ' Reflects the Portfolio Filter above.' : ''),
      loans,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-start gap-2">
            <Filter className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <CardTitle className="text-base">{t('dashboard.portfolioFilter.title')}</CardTitle>
              <CardDescription>
                Drives every portfolio card below - Overview, Quality Metrics, Loan Disbursement Trend, Collections vs. Target,
                Portfolio Breakdown, and Loan Portfolio Health all recompute live. Collections Forecast and Recommendation are
                portfolio-wide by design and stay unaffected.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dashboard-category-filter" className="text-xs">
                Loan Category
              </Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="dashboard-category-filter" className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
                  {loanCategoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredActiveCount}</span> active loan account
            {filteredActiveCount === 1 ? '' : 's'} · <span className="font-medium text-foreground">{formatPeso(filteredOutstandingTotal)}</span>{' '}
            total outstanding principal
            {isFiltered ? ' matching the selected filter' : ' across the whole portfolio'}.
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t('dashboard.overview.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {liveSummary
            ? 'Live portfolio summary across all branches. '
            : isFiltered
              ? 'Live figures, computed from the loan accounts matching the Portfolio Filter above. '
              : summaryQuery.isError
                ? 'Could not reach the backend - showing sample data below. '
                : 'Loading live portfolio summary… '}
          Click a chart segment, bar, or figure to see the loan accounts behind it.
        </p>
      </div>

      {summaryQuery.isError && !isFiltered && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load live dashboard totals. Is the backend running? Showing sample
          data below instead.
        </div>
      )}

      {isPortfolioLoading && (
        <p className="text-sm text-muted-foreground">Loading live portfolio data ({allPortfolioLoans.length} loan accounts so far)…</p>
      )}
      {(loanAccountsQuery.isError || borrowersQuery.isError || productsQuery.isError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load the live loan portfolio. Quality Metrics, Disbursement Trend,
          Portfolio Breakdown, and Loan Portfolio Health below will be empty until this loads.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title={t('dashboard.stat.activeLoans')}
          value={liveSummary ? liveSummary.totalActiveLoans.count.toString() : filteredActiveCount.toString()}
          hint={
            liveSummary
              ? `${formatPeso(Number(liveSummary.totalActiveLoans.outstandingPrincipalBalance))} outstanding principal`
              : `${formatPeso(filteredOutstandingTotal)} outstanding principal`
          }
          icon={Landmark}
          onClick={() =>
            setDrillDown({
              title: 'Total Active Loans',
              description:
                'All still-active loan accounts - ACTIVE, ACTIVE_IN_ARREARS, and MATURED.' +
                (isFiltered ? ' Reflects the Portfolio Filter above.' : ' Across all branches.'),
              loans: filteredActivePortfolioLoans,
            })
          }
        />
        <SummaryCard
          title={t('dashboard.stat.collectionsThisMonth')}
          value={liveSummary ? formatPeso(Number(liveSummary.collectionsThisMonth.amount)) : formatPeso(scaledCollectionsThisMonth)}
          hint={liveSummary ? 'Live, across all branches' : isFiltered ? 'Estimated for the selected filter' : 'Across all branches'}
          icon={Banknote}
          trend={liveSummary ? { changePercent: liveSummary.collectionsThisMonth.trend.changePercent, label: 'vs same days last month, portfolio-wide' } : undefined}
        />
        <SummaryCard
          title={t('dashboard.stat.overdueAccounts')}
          value={liveSummary ? liveSummary.overdueAccounts.count.toString() : filteredPortfolioHealth.activeInArrears.count.toString()}
          hint={
            liveSummary
              ? `${formatPeso(Number(liveSummary.overdueAccounts.atRiskCollectionsBalance))} at risk (collections balance)`
              : `${formatPeso(filteredPortfolioHealth.activeInArrears.collectionsBalance)} at risk (collections balance)`
          }
          icon={AlertOctagon}
          tone="destructive"
          onClick={() => openVennSegment('activeInArrears')}
        />
        <SummaryCard
          title={t('dashboard.stat.portfolioGrowth')}
          value="+4.8%"
          hint="Month-over-month disbursement (portfolio-wide) - sample data"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.portfolioQuality.title')}</CardTitle>
          <CardDescription>
            Industry-standard portfolio quality indicators, computed live{isFiltered ? ' against the Portfolio Filter above' : ''}.
            Hover the ⓘ for each term's definition; click a value to see the accounts behind it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricItem
            term={FINANCIAL_GLOSSARY.delinquencyRate.term}
            definition={FINANCIAL_GLOSSARY.delinquencyRate.definition}
            value={`${filteredQualityMetrics.delinquencyRatePercent.toFixed(1)}%`}
            onClick={openDelinquentAccounts}
          />
          <MetricItem
            term={FINANCIAL_GLOSSARY.portfolioAtRisk.term}
            definition={FINANCIAL_GLOSSARY.portfolioAtRisk.definition}
            value={`${filteredQualityMetrics.portfolioAtRiskPercent.toFixed(1)}%`}
            onClick={openDelinquentAccounts}
          />
          <MetricItem
            term={FINANCIAL_GLOSSARY.averageLoanSize.term}
            definition={FINANCIAL_GLOSSARY.averageLoanSize.definition}
            value={formatPeso(filteredQualityMetrics.averageLoanSize)}
            onClick={() =>
              setDrillDown({
                title: 'Active Portfolio',
                description:
                  'All still-active loan accounts (ACTIVE, ACTIVE_IN_ARREARS, MATURED) used to compute the average loan size.' +
                  (isFiltered ? ' Reflects the Portfolio Filter above.' : ''),
                loans: filteredActivePortfolioLoans,
              })
            }
          />
          <MetricItem
            term={FINANCIAL_GLOSSARY.writeOff.term}
            definition={FINANCIAL_GLOSSARY.writeOff.definition}
            value={formatPeso(filteredQualityMetrics.writtenOffExposure)}
            onClick={() =>
              setDrillDown({
                title: 'Written-off Loan Accounts',
                description:
                  'CLOSED_WRITTEN_OFF accounts - the realized-loss segment behind the Write-off exposure metric.' +
                  (isFiltered ? ' Reflects the Portfolio Filter above.' : ''),
                loans: filteredPortfolioHealth.writtenOff.loans,
              })
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.disbursementTrend.title')}</CardTitle>
            <CardDescription>
              Monthly gross disbursement, last 6 months - click a bar for that month's activated accounts
              {isFiltered ? ' · reflects the Portfolio Filter above' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredDisbursementTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={pesoTooltipFormatter} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Bar
                  dataKey="disbursed"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const bucket = (data as { payload?: { month: string; year: number; monthIndex: number } }).payload;
                    if (bucket) openDisbursementMonth(bucket);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.collectionsVsTarget.title')}</CardTitle>
            <CardDescription>
              Monthly actual collections against target
              {isFiltered ? ' · estimated for the selected filter, scaled proportionally to outstanding principal' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scaledCollectionsVsTarget}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={pesoTooltipFormatter} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="actual" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.collectionsForecast.title')}</CardTitle>
            <CardDescription>Next 4 months, from each active loan's own repayment schedule - portfolio-wide, not affected by the Portfolio Filter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summaryQuery.data?.collectionsForecast ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={pesoTooltipFormatter} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  <Line
                    type="monotone"
                    dataKey={(d: { scheduledAmount: string }) => Number.parseFloat(d.scheduledAmount) || 0}
                    name="Scheduled"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Bottom-up, not a fitted trend line: sums each active loan's own scheduled principal + interest due per month, straight
              from its repayment schedule. Stays portfolio-wide by design - a cash-flow forecast is most useful as a whole-company
              number. Not adjusted by a collection-realization rate - that would need a real monthly collection target to compute
              against, which doesn't exist yet (see "Collections vs. Target" below).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.categoryBreakdown.title')}</CardTitle>
          <CardDescription>
            Outstanding principal across the 3 active categories (SML = Seafarer Loan sub-class) - click a slice for its accounts
            {isFiltered ? ' · reflects the filter above' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPortfolioByCategory.length === 0 ? (
            <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No active loan accounts match the selected filter.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filteredPortfolioByCategory}
                      dataKey="value"
                      nameKey="category"
                      innerRadius={45}
                      outerRadius={68}
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(data) => {
                        const slice = (data as { payload?: PortfolioCategorySlice }).payload;
                        if (slice?.category) openCategorySlice(slice);
                      }}
                    >
                      {filteredPortfolioByCategory.map((entry, index) => (
                        <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={pesoTooltipFormatter} contentStyle={TOOLTIP_CONTENT_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {filteredPortfolioByCategory.map((entry, index) => (
                  <button
                    key={entry.category}
                    type="button"
                    onClick={() => openCategorySlice(entry)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus:outline-none"
                    title="View the loan accounts in this category"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="font-medium text-foreground">{entry.category}</span>
                    <span>· {formatPeso(entry.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.portfolioHealth.title')}</CardTitle>
          <CardDescription>
            Good vs. Matured loan accounts, with the overlap — Active Accounts in Arrears: still active and paying, just sometimes
            late, where Easycash earns penalty/late-fee income on top of amortization. "Matured" is a loan whose final installment
            due date has already passed and is still unpaid. Click any region for the accounts behind it.
            {isFiltered ? ' Reflects the filter above.' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoanPortfolioVennDiagram
            good={filteredPortfolioHealth.good}
            activeInArrears={filteredPortfolioHealth.activeInArrears}
            matured={filteredPortfolioHealth.matured}
            onSegmentClick={openVennSegment}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>{t('dashboard.recommendation.title')}</CardTitle>
            <CardDescription>Portfolio-wide strategic guidance - not affected by the Portfolio Filter above.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            {PORTFOLIO_HEALTH_PLANS.map((plan) => (
              <div key={plan.key} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <plan.icon className={`h-4 w-4 ${plan.iconClass}`} />
                    <span className="text-sm font-semibold">{plan.title}</span>
                  </div>
                  <Badge variant={plan.badgeVariant}>{plan.segment}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{plan.body}</p>
              </div>
            ))}
          </div>
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
            AI-Assisted - these are draft discussion points for management, not automated actions. This output is a static mock; the
            LMS is not yet connected to an API for a real AI Assist engine.
          </p>
        </CardContent>
      </Card>

      <LoanDrillDownDialog drillDown={drillDown} onClose={() => setDrillDown(null)} />

      <RecentActivityPanel label="Dashboard" />
    </div>
  );
}
