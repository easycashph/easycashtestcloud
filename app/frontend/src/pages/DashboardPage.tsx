import * as React from 'react';
import type { ComponentType } from 'react';
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
import { AlertOctagon, AlertTriangle, Banknote, Filter, Landmark, RotateCcw, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
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
import {
  buildDisbursementTrend,
  buildPortfolioByCategory,
  buildPortfolioHealth,
  buildPortfolioQualityMetrics,
  COLLECTIONS_VS_TARGET,
  DASHBOARD_SUMMARY,
  getDashboardLoanCategory,
  LOAN_CATEGORY_OPTIONS,
  MOCK_ACTIVITY_LOGS,
  MOCK_LOANS,
  SAMPLE_COLLECTIONS_PROJECTION,
  type PortfolioCategorySlice,
} from '@/lib/mockData';
import { formatPeso, pesoTooltipFormatter } from '@/lib/utils';

// Deliberately excludes --chart-1: that variable is re-themed per the LMS Configuration
// accent color (emerald/violet/amber/rose) and can collide with one of the other fixed
// chart hues (e.g. the default emerald accent looks identical to --chart-3's green). These
// four stay fixed across every accent theme, so categories are always visually distinct.
const CHART_COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// Recharts' <Tooltip> defaults to a plain white box, which stays white in dark mode too — reads
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
      'Still active and paying, just sometimes late — the segment where Easycash earns penalty/late-fee income on top of amortization.',
  },
  matured: {
    title: 'Matured Loan Accounts',
    description:
      'Active accounts past their full maturity date but still unpaid, with an outstanding balance — the highest-risk active segment (distinct from a settled Closed loan).',
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
      'These borrowers pay on schedule with no penalty history. Keep servicing simple — reminders on the standard schedule, no manual follow-up — and prioritize them for renewal/repeat-loan offers first.',
  },
  {
    key: 'activeInArrears',
    title: 'Protect the margin',
    segment: 'Accounts in Arrears',
    icon: Sparkles,
    iconClass: 'text-warning',
    badgeVariant: 'warning',
    body:
      'Still active and still paying, just sometimes late — the penalty/late-fee income here is real, confirmed revenue on top of amortization. Keep the reminder cadence that nudges them back on time, but avoid over-aggressive collection tactics that could push a paying borrower into default and remove this income entirely.',
  },
  {
    key: 'matured',
    title: 'Resolve',
    segment: 'Matured accounts',
    icon: AlertTriangle,
    iconClass: 'text-destructive',
    badgeVariant: 'destructive',
    body:
      'These loans have run past their full maturity date and are still unpaid — the highest-risk active segment, one step short of write-off. Escalate to intensive collection, and evaluate restructuring or a formal repayment plan to bring the balance back into a payable schedule before the loss is realized. Distinct from a settled Closed loan, which needs no action.',
  },
];

function SummaryCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'destructive';
  onClick?: () => void;
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
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
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
  const [drillDown, setDrillDown] = React.useState<LoanDrillDown | null>(null);

  // Portfolio Filter — the master filter for the whole Dashboard (loan category + origination
  // date range). Every portfolio card below (Overview summary cards, Quality Metrics, Loan
  // Disbursement Trend, Collections vs. Target, Portfolio Breakdown, Loan Portfolio Health) reacts
  // to it. Two cards are deliberately exempt, by design, not oversight: Collections Forecast
  // (a bottom-up projection from each active loan's own fixed repayment schedule — filtering it
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
    return MOCK_LOANS.filter((loan) => {
      if (categoryFilter !== ALL_CATEGORIES && getDashboardLoanCategory(loan) !== categoryFilter) return false;
      const originated = new Date(loan.createdAt).getTime();
      if (fromTime !== null && originated < fromTime) return false;
      if (toTime !== null && originated > toTime) return false;
      return true;
    });
  }, [categoryFilter, dateRange]);

  const filteredPortfolioHealth = React.useMemo(() => buildPortfolioHealth(portfolioFilteredLoans), [portfolioFilteredLoans]);
  const filteredPortfolioByCategory = React.useMemo(
    () => buildPortfolioByCategory(portfolioFilteredLoans),
    [portfolioFilteredLoans],
  );
  const filteredQualityMetrics = React.useMemo(
    () => buildPortfolioQualityMetrics(portfolioFilteredLoans),
    [portfolioFilteredLoans],
  );
  const filteredDisbursementTrend = React.useMemo(
    () => buildDisbursementTrend(portfolioFilteredLoans, 6),
    [portfolioFilteredLoans],
  );
  const filteredActiveCount =
    filteredPortfolioHealth.good.count + filteredPortfolioHealth.activeInArrears.count + filteredPortfolioHealth.matured.count;
  const filteredOutstandingTotal =
    filteredPortfolioByCategory.reduce((sum, slice) => sum + slice.value, 0) ||
    filteredPortfolioHealth.good.collectionsBalance +
      filteredPortfolioHealth.activeInArrears.collectionsBalance +
      filteredPortfolioHealth.matured.collectionsBalance;

  // Every active loan under the current filter (performing, in arrears, and past-maturity-but-
  // unpaid) — the denominator/drill-down set behind the filtered Total Active Loans and Average
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
  // date in the mock data model to sum bottom-up (see the Collections Forecast doc comment in
  // mockData.ts for why the Forecast card *can* do this and these two can't). Scaled proportionally
  // to how much of the whole portfolio's outstanding principal the current filter selects, so the
  // figures still move honestly with the filter instead of staying frozen — clearly disclosed as
  // an estimate, not implied precision.
  const filterRatio = DASHBOARD_SUMMARY.totalPortfolioValue > 0 ? filteredOutstandingTotal / DASHBOARD_SUMMARY.totalPortfolioValue : 1;
  const scaledCollectionsThisMonth = round2Peso(DASHBOARD_SUMMARY.totalCollectionsThisMonth * filterRatio);
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
        'Overdue but still active — accounts in arrears (overdue within term) plus matured accounts (past the full term, still unpaid). This is the set behind the Delinquency Rate and Portfolio-at-Risk figures.' +
        (isFiltered ? ' Reflects the Portfolio Filter above.' : ''),
      loans: filteredDelinquentLoans,
    });

  const openVennSegment = (segment: PortfolioHealthSegment) =>
    setDrillDown({ ...VENN_SEGMENT_META[segment], loans: filteredPortfolioHealth[segment].loans });

  const openCategorySlice = (slice: PortfolioCategorySlice) =>
    setDrillDown({
      title: `${slice.category} — Active Portfolio`,
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
        'The mock loan accounts whose activation date falls in the selected month.' +
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
              <CardTitle className="text-base">Portfolio Filter</CardTitle>
              <CardDescription>
                Drives every portfolio card below — Overview, Quality Metrics, Loan Disbursement Trend, Collections vs. Target,
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
                  {LOAN_CATEGORY_OPTIONS.map((category) => (
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
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Portfolio summary across all branches — sample data{isFiltered ? ', reflecting the Portfolio Filter above' : ''}. Click a
          chart segment, bar, or figure to see the loan accounts behind it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Active Loans"
          value={filteredActiveCount.toString()}
          hint={`${formatPeso(filteredOutstandingTotal)} outstanding principal`}
          icon={Landmark}
          onClick={() =>
            setDrillDown({
              title: 'Total Active Loans',
              description:
                'All still-active loan accounts — ACTIVE, ACTIVE_IN_ARREARS, and MATURED.' +
                (isFiltered ? ' Reflects the Portfolio Filter above.' : ' Across all branches.'),
              loans: filteredActivePortfolioLoans,
            })
          }
        />
        <SummaryCard
          title="Collections This Month"
          value={formatPeso(scaledCollectionsThisMonth)}
          hint={isFiltered ? 'Estimated for the selected filter' : 'Across all branches'}
          icon={Banknote}
        />
        <SummaryCard
          title="Overdue Accounts"
          value={filteredPortfolioHealth.activeInArrears.count.toString()}
          hint={`${formatPeso(filteredPortfolioHealth.activeInArrears.collectionsBalance)} at risk (collections balance)`}
          icon={AlertOctagon}
          tone="destructive"
          onClick={() => openVennSegment('activeInArrears')}
        />
        <SummaryCard
          title="Portfolio Growth"
          value="+4.8%"
          hint="Month-over-month disbursement (portfolio-wide)"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Quality Metrics</CardTitle>
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
                  'CLOSED_WRITTEN_OFF accounts — the realized-loss segment behind the Write-off exposure metric.' +
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
            <CardTitle>Loan Disbursement Trend</CardTitle>
            <CardDescription>
              Monthly gross disbursement, last 6 months — click a bar for that month's activated accounts
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
            <CardTitle>Collections vs. Target</CardTitle>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Collections Forecast</CardTitle>
              <CardDescription>Next 4 months, from each active loan's own repayment schedule — portfolio-wide, not affected by the Portfolio Filter</CardDescription>
            </div>
            <Badge variant="warning">Sample Projection</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SAMPLE_COLLECTIONS_PROJECTION}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={pesoTooltipFormatter} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  <Line type="monotone" dataKey="projected" stroke="hsl(var(--chart-4))" strokeWidth={2} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Bottom-up, not a fitted trend line: sums each active loan's actual scheduled installments due per month, then applies
              the portfolio's own recent collection-realization rate (average actual ÷ target). Stays portfolio-wide by design — a
              cash-flow forecast is most useful as a whole-company number. Still a sample-data illustration, not a production
              forecasting engine.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Breakdown by Loan Category</CardTitle>
          <CardDescription>
            Outstanding principal across the 3 active categories (SML = Seafarer Loan sub-class) — click a slice for its accounts
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
          <CardTitle>Loan Portfolio Health</CardTitle>
          <CardDescription>
            Good vs. Matured loan accounts, with the overlap — Active Accounts in Arrears: still active and paying, just sometimes
            late, where Easycash earns penalty/late-fee income on top of amortization. Click any region for the accounts behind it.
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
            <CardTitle>Recommendation</CardTitle>
            <CardDescription>Portfolio-wide strategic guidance — not affected by the Portfolio Filter above.</CardDescription>
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
            AI-Assisted — these are draft discussion points for management, not automated actions. This output is a static mock; the
            LMS is not yet connected to an API for a real AI Assist engine.
          </p>
        </CardContent>
      </Card>

      <LoanDrillDownDialog drillDown={drillDown} onClose={() => setDrillDown(null)} />

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Dashboard')} title="Recent Activity — Dashboard" />
    </div>
  );
}
