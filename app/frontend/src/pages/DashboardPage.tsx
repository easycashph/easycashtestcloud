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
import { AlertOctagon, AlertTriangle, Banknote, Landmark, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import type { BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { LoanPortfolioVennDiagram, type PortfolioHealthSegment } from '@/components/LoanPortfolioVennDiagram';
import { LoanDrillDownDialog, type LoanDrillDown } from '@/components/LoanDrillDownDialog';
import { TermTip } from '@/components/TermTip';
import { FINANCIAL_GLOSSARY } from '@/lib/financialGlossary';
import { useLogPageView } from '@/lib/activityLog';
import {
  COLLECTIONS_VS_TARGET,
  DASHBOARD_SUMMARY,
  DISBURSEMENT_TREND,
  MOCK_ACTIVITY_LOGS,
  MOCK_LOANS,
  PORTFOLIO_BY_CATEGORY,
  PORTFOLIO_HEALTH,
  PORTFOLIO_QUALITY_METRICS,
  SAMPLE_COLLECTIONS_PROJECTION,
  type PortfolioCategorySlice,
} from '@/lib/mockData';
import { formatPeso, pesoTooltipFormatter } from '@/lib/utils';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export function DashboardPage() {
  useLogPageView('Dashboard');
  const [drillDown, setDrillDown] = React.useState<LoanDrillDown | null>(null);

  // The active portfolio is every still-active account: performing (good), in arrears, AND
  // past-maturity-but-unpaid (matured). Must match DASHBOARD_SUMMARY.totalActiveLoans and the
  // PORTFOLIO_QUALITY_METRICS denominators, which all include MATURED — otherwise a figure and
  // its drill-down list disagree.
  const activePortfolioLoans = React.useMemo(
    () => [...PORTFOLIO_HEALTH.good.loans, ...PORTFOLIO_HEALTH.activeInArrears.loans, ...PORTFOLIO_HEALTH.matured.loans],
    [],
  );

  // Delinquent = overdue but still active: in arrears (overdue within term) + matured (past the
  // full term, still unpaid). This is the numerator behind the Delinquency Rate and PAR metrics.
  const delinquentLoans = React.useMemo(
    () => [...PORTFOLIO_HEALTH.activeInArrears.loans, ...PORTFOLIO_HEALTH.matured.loans],
    [],
  );

  const openDelinquentAccounts = () =>
    setDrillDown({
      title: 'Delinquent Accounts',
      description:
        'Overdue but still active — accounts in arrears (overdue within term) plus matured accounts (past the full term, still unpaid). This is the set behind the Delinquency Rate and Portfolio-at-Risk figures.',
      loans: delinquentLoans,
    });

  const openVennSegment = (segment: PortfolioHealthSegment) =>
    setDrillDown({ ...VENN_SEGMENT_META[segment], loans: PORTFOLIO_HEALTH[segment].loans });

  const openCategorySlice = (slice: PortfolioCategorySlice) =>
    setDrillDown({
      title: `${slice.category} — Active Portfolio`,
      description: `Still-active loan accounts (active, in arrears, or matured) under the ${slice.category} category (${formatPeso(slice.value)} outstanding principal). SML products roll up under Seafarer Loan.`,
      loans: slice.loans,
    });

  const openDisbursementMonth = (month: string) => {
    const year = new Date().getFullYear();
    const monthIdx = MONTH_NAMES.indexOf(month);
    const loans = MOCK_LOANS.filter((l) => {
      if (!l.activatedAt) return false;
      const activated = new Date(l.activatedAt);
      return activated.getMonth() === monthIdx && activated.getFullYear() === year;
    });
    setDrillDown({
      title: `Loans activated in ${month} ${year}`,
      description:
        'Bar heights are sample aggregate figures; this list shows the mock loan accounts whose activation date falls in the selected month.',
      loans,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Portfolio summary across all branches — sample data. Click a chart segment, bar, or figure to see the loan accounts behind
          it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Active Loans"
          value={DASHBOARD_SUMMARY.totalActiveLoans.toString()}
          hint={`${formatPeso(DASHBOARD_SUMMARY.totalPortfolioValue)} outstanding principal`}
          icon={Landmark}
          onClick={() =>
            setDrillDown({
              title: 'Total Active Loans',
              description: 'All still-active loan accounts across all branches — ACTIVE, ACTIVE_IN_ARREARS, and MATURED.',
              loans: activePortfolioLoans,
            })
          }
        />
        <SummaryCard
          title="Collections This Month"
          value={formatPeso(DASHBOARD_SUMMARY.totalCollectionsThisMonth)}
          hint="Across all branches"
          icon={Banknote}
        />
        <SummaryCard
          title="Overdue Accounts"
          value={DASHBOARD_SUMMARY.overdueAccounts.toString()}
          hint={`${formatPeso(DASHBOARD_SUMMARY.overdueAmount)} at risk (collections balance)`}
          icon={AlertOctagon}
          tone="destructive"
          onClick={() => openVennSegment('activeInArrears')}
        />
        <SummaryCard
          title="Portfolio Growth"
          value="+4.8%"
          hint="Month-over-month disbursement"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Quality Metrics</CardTitle>
          <CardDescription>
            Industry-standard portfolio quality indicators, computed live from the sample portfolio. Hover the ⓘ for each term's
            definition; click a value to see the accounts behind it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricItem
            term={FINANCIAL_GLOSSARY.delinquencyRate.term}
            definition={FINANCIAL_GLOSSARY.delinquencyRate.definition}
            value={`${PORTFOLIO_QUALITY_METRICS.delinquencyRatePercent.toFixed(1)}%`}
            onClick={openDelinquentAccounts}
          />
          <MetricItem
            term={FINANCIAL_GLOSSARY.portfolioAtRisk.term}
            definition={FINANCIAL_GLOSSARY.portfolioAtRisk.definition}
            value={`${PORTFOLIO_QUALITY_METRICS.portfolioAtRiskPercent.toFixed(1)}%`}
            onClick={openDelinquentAccounts}
          />
          <MetricItem
            term={FINANCIAL_GLOSSARY.averageLoanSize.term}
            definition={FINANCIAL_GLOSSARY.averageLoanSize.definition}
            value={formatPeso(PORTFOLIO_QUALITY_METRICS.averageLoanSize)}
            onClick={() =>
              setDrillDown({
                title: 'Active Portfolio',
                description:
                  'All still-active loan accounts (ACTIVE, ACTIVE_IN_ARREARS, MATURED) used to compute the average loan size.',
                loans: activePortfolioLoans,
              })
            }
          />
          <MetricItem
            term={FINANCIAL_GLOSSARY.writeOff.term}
            definition={FINANCIAL_GLOSSARY.writeOff.definition}
            value={formatPeso(PORTFOLIO_QUALITY_METRICS.writtenOffExposure)}
            onClick={() =>
              setDrillDown({
                title: 'Written-off Loan Accounts',
                description: 'CLOSED_WRITTEN_OFF accounts — the realized-loss segment behind the Write-off exposure metric.',
                loans: PORTFOLIO_HEALTH.writtenOff.loans,
              })
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Disbursement Trend</CardTitle>
            <CardDescription>Monthly gross disbursement, last 6 months — click a bar for that month's activated accounts</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DISBURSEMENT_TREND}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={pesoTooltipFormatter} />
                <Bar
                  dataKey="disbursed"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const month = (data as { payload?: { month?: string } }).payload?.month;
                    if (month) openDisbursementMonth(month);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collections vs. Target</CardTitle>
            <CardDescription>Monthly actual collections against target</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={COLLECTIONS_VS_TARGET}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={pesoTooltipFormatter} />
                <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="actual" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Breakdown by Loan Category</CardTitle>
            <CardDescription>
              Outstanding principal across the 3 active categories (SML = Seafarer Loan sub-class) — click a slice for its accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PORTFOLIO_BY_CATEGORY}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(data) => {
                    const slice = (data as { payload?: PortfolioCategorySlice }).payload;
                    if (slice?.category) openCategorySlice(slice);
                  }}
                >
                  {PORTFOLIO_BY_CATEGORY.map((entry, index) => (
                    <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={pesoTooltipFormatter} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {PORTFOLIO_BY_CATEGORY.map((entry, index) => (
                <button
                  key={entry.category}
                  type="button"
                  onClick={() => openCategorySlice(entry)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none"
                  title="View the loan accounts in this category"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  {entry.category}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Collections Forecast</CardTitle>
              <CardDescription>Simple projected trend, next 4 months</CardDescription>
            </div>
            <Badge variant="warning">Sample Projection</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SAMPLE_COLLECTIONS_PROJECTION}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={pesoTooltipFormatter} />
                <Line type="monotone" dataKey="projected" stroke="hsl(var(--chart-4))" strokeWidth={2} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-1 text-xs text-muted-foreground">
              Illustrative only — a simple linear projection over sample data, not a statistical forecasting model. No real forecasting
              engine exists yet.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan Portfolio Health</CardTitle>
          <CardDescription>
            Good vs. Matured loan accounts, with the overlap — Active Accounts in Arrears: still active and paying, just sometimes
            late, where Easycash earns penalty/late-fee income on top of amortization. Click any region for the accounts behind it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoanPortfolioVennDiagram
            good={PORTFOLIO_HEALTH.good}
            activeInArrears={PORTFOLIO_HEALTH.activeInArrears}
            matured={PORTFOLIO_HEALTH.matured}
            onSegmentClick={openVennSegment}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>AI Portfolio Assist</CardTitle>
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
