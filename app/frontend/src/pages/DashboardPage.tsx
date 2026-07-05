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
import { AlertOctagon, Banknote, Landmark, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import {
  COLLECTIONS_VS_TARGET,
  DASHBOARD_SUMMARY,
  DISBURSEMENT_TREND,
  MOCK_ACTIVITY_LOGS,
  PORTFOLIO_BY_PRODUCT,
  SAMPLE_COLLECTIONS_PROJECTION,
} from '@/lib/mockData';
import { formatPeso, pesoTooltipFormatter } from '@/lib/utils';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

function SummaryCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'destructive';
}) {
  return (
    <Card>
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

export function DashboardPage() {
  useLogPageView('Dashboard');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">Portfolio summary across all branches — sample data.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Active Loans"
          value={DASHBOARD_SUMMARY.totalActiveLoans.toString()}
          hint={`${formatPeso(DASHBOARD_SUMMARY.totalPortfolioValue)} outstanding principal`}
          icon={Landmark}
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
        />
        <SummaryCard
          title="Portfolio Growth"
          value="+4.8%"
          hint="Month-over-month disbursement"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Disbursement Trend</CardTitle>
            <CardDescription>Monthly gross disbursement, last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DISBURSEMENT_TREND}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={pesoTooltipFormatter} />
                <Bar dataKey="disbursed" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
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
            <CardTitle>Portfolio Breakdown by Product</CardTitle>
            <CardDescription>Outstanding principal, active + in-arrears loans</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={PORTFOLIO_BY_PRODUCT} dataKey="value" nameKey="product" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {PORTFOLIO_BY_PRODUCT.map((entry, index) => (
                    <Cell key={entry.product} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={pesoTooltipFormatter} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {PORTFOLIO_BY_PRODUCT.map((entry, index) => (
                <span key={entry.product} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  {entry.product}
                </span>
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

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Dashboard')} title="Recent Activity — Dashboard" />
    </div>
  );
}
