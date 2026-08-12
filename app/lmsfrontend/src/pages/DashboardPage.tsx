import * as React from 'react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTheme } from '@/components/theme-provider';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
  GripVertical,
  Landmark,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DateRange } from '@/components/DateRangeFilter';
import { RecentSystemActivityPanel } from '@/components/RecentSystemActivityPanel';
import { LoanPortfolioVennDiagram, type PortfolioHealthSegment } from '@/components/LoanPortfolioVennDiagram';
import { LoanDrillDownDialog, type LoanDrillDown } from '@/components/LoanDrillDownDialog';
import { TermTip } from '@/components/TermTip';
import { FINANCIAL_GLOSSARY } from '@/lib/financialGlossary';
import { useLogPageView } from '@/lib/activityLog';
import { useLanguage } from '@/lib/languageContext';
import { useRole } from '@/lib/roleContext';
import { COMPANY_INFO } from '@/lib/staticConfig';
import { useDashboardLayout, type DashboardCardId } from '@/components/dashboard-layout-provider';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import type { CollectionReportRow, OriginationReportRow } from '@/lib/reportApiTypes';
import type { DashboardSummary } from '@/lib/dashboardApiTypes';
import type { Borrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';
import { cn, formatPeso, isoDate, pesoTooltipFormatter } from '@/lib/utils';

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
  isMatured: boolean;
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
  /** Outstanding principal split by the same good/arrears/matured definition as
   * `buildRealPortfolioHealth` (live `overdueLoanIds`/`maturedLoanIds`, not `status`). */
  active: number;
  pastDue: number;
  matured: number;
  /** Loan account counts for the same three buckets. */
  activeCount: number;
  pastDueCount: number;
  maturedCount: number;
}

function buildRealPortfolioByCategory(
  loans: PortfolioLoanRow[],
  overdueLoanIds: ReadonlySet<string>,
  maturedLoanIds: ReadonlySet<string>,
): PortfolioCategorySlice[] {
  const byCategory = new Map<string, PortfolioCategorySlice>();
  for (const loan of loans) {
    if (!REAL_ACTIVE_STATUSES.includes(loan.status)) continue;
    const slice =
      byCategory.get(loan.category) ??
      { category: loan.category, value: 0, loans: [], active: 0, pastDue: 0, matured: 0, activeCount: 0, pastDueCount: 0, maturedCount: 0 };
    slice.value = Math.round((slice.value + loan.principalBalance) * 100) / 100;
    if (maturedLoanIds.has(loan.id)) {
      slice.matured = Math.round((slice.matured + loan.principalBalance) * 100) / 100;
      slice.maturedCount += 1;
    } else if (overdueLoanIds.has(loan.id)) {
      slice.pastDue = Math.round((slice.pastDue + loan.principalBalance) * 100) / 100;
      slice.pastDueCount += 1;
    } else {
      slice.active = Math.round((slice.active + loan.principalBalance) * 100) / 100;
      slice.activeCount += 1;
    }
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

/**
 * 2026-08-05 (user-reported bug fix): Portfolio Growth used to compare the CURRENT month's
 * disbursement bucket (partial - only however many days have elapsed so far, e.g. just Aug 1-5)
 * directly against the FULL previous month - always reading a huge, misleading negative number
 * early in any month regardless of actual disbursement pace. Mirrors the backend's own
 * `sameElapsedPointLastMonth` convention (`PrismaDashboardRepository.ts`, already used correctly
 * for Collections This Month's trend) - compares "this month so far" against "the same number of
 * days into last month" instead.
 */
function buildElapsedMatchedDisbursementComparison(loans: PortfolioLoanRow[]) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthElapsedEnd = new Date(previousMonthStart.getTime() + (now.getTime() - currentMonthStart.getTime()));

  let current = 0;
  let previous = 0;
  for (const loan of loans) {
    if (!loan.activatedAt) continue;
    const activated = new Date(loan.activatedAt);
    if (activated >= currentMonthStart && activated <= now) {
      current += loan.principalAmount;
    } else if (activated >= previousMonthStart && activated < previousMonthElapsedEnd) {
      previous += loan.principalAmount;
    }
  }
  return { current: Math.round(current * 100) / 100, previous: Math.round(previous * 100) / 100 };
}

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

/** Stage color ramps - taper segments use the 100 stop (light fill) with 800-stop text, matching
 * the funnel mockup shown to and approved by the user 2026-07-17. Declined uses the red ramp since
 * it's a branch/exit, not part of the taper. */
const PIPELINE_STAGE_STYLE: Record<string, { fill: string; text: string }> = {
  totalApplications: { fill: '#173B5E', text: '#CFE3F7' },
  requirementCompliance: { fill: '#E6F1FB', text: '#0C447C' },
  underwriting: { fill: '#B5D4F4', text: '#0C447C' },
  review: { fill: '#85B7EB', text: '#042C53' },
  approved: { fill: '#C0DD97', text: '#27500A' },
  released: { fill: '#97C459', text: '#173404' },
};

/**
 * 2026-07-17: LoanApplication pipeline funnel - mirrors the mockup shown to and approved by the
 * user, now driven by `DashboardSummary.loanApplicationPipeline` instead of sample numbers. Hand-
 * rolled SVG (same convention as the mockup and the Portfolio Breakdown div-bars below) since
 * Recharts has no first-class funnel chart type. `approved`/`released` are sequential, non-
 * overlapping segments - see the backend field's own doc comment.
 *
 * 2026-07-17 v2 fix: the first version based every %/taper width on `requirementCompliance` (the
 * first per-stage bucket), which is frequently 0 for this dataset (most legacy applications never
 * passed through this system's own PREAPPROVED stage) - a 0 basis produced an inverted/oversized
 * taper and a "Declined 300%" reading. Now leads with an explicit "Total Applications" bar (every
 * stage + declined summed) as the taper's basis, so % is always relative to a real, non-zero total.
 */
function LoanApplicationPipelineFunnel({ pipeline: pipelineProp }: { pipeline: DashboardSummary['loanApplicationPipeline'] | undefined }) {
  // Defensive against an older backend deployment that predates this field (would otherwise be
  // `undefined` on the wire despite the type saying required) - falls back to an all-zero pipeline
  // instead of crashing the whole Dashboard.
  const pipeline = pipelineProp ?? { requirementCompliance: 0, underwriting: 0, review: 0, approved: 0, released: 0, declined: 0 };
  const totalApplications =
    pipeline.requirementCompliance + pipeline.underwriting + pipeline.review + pipeline.approved + pipeline.released + pipeline.declined;
  const stages: { key: keyof typeof PIPELINE_STAGE_STYLE; label: string; value: number }[] = [
    { key: 'totalApplications', label: 'Total Applications', value: totalApplications },
    { key: 'requirementCompliance', label: 'Requirement compliance', value: pipeline.requirementCompliance },
    { key: 'underwriting', label: 'Underwriting', value: pipeline.underwriting },
    { key: 'review', label: 'Review', value: pipeline.review },
    { key: 'approved', label: 'Approved', value: pipeline.approved },
    { key: 'released', label: 'Released', value: pipeline.released },
  ];
  const basis = totalApplications || 1;
  const cx = 260;
  const top = 20;
  const rowH = 62;
  const minHalfW = 40;
  const maxHalfW = 230;
  const halfWidthFor = (v: number) => minHalfW + (v / basis) * (maxHalfW - minHalfW);

  const segments = stages.map((s, i) => {
    const y0 = top + i * rowH;
    const y1 = y0 + rowH - 4;
    const w0 = halfWidthFor(s.value);
    const nextValue = i < stages.length - 1 ? stages[i + 1]!.value : Math.round(s.value * 0.7);
    const w1 = i < stages.length - 1 ? halfWidthFor(nextValue) : Math.max(minHalfW * 0.6, w0 * 0.7);
    // % of Total Applications, not of the previous stage - keeps every stage's % on the same basis.
    const pctOfTotal = i > 0 ? Math.round((s.value / basis) * 100) : null;
    const style = PIPELINE_STAGE_STYLE[s.key]!;
    return { ...s, y0, y1, w0, w1, pctOfTotal, style };
  });
  const svgHeight = top + stages.length * rowH + 20;
  const declinedPct = Math.round((pipeline.declined / basis) * 100);
  const underwritingSeg = segments[2]!; // branch point: after Underwriting, before Review
  const declinedBranchY = top + rowH * 2.5;
  // Clamped so the Declined callout box (150 wide) never runs past the 640-wide viewBox, however
  // wide the Underwriting segment gets.
  const declinedBoxX = Math.min(cx + underwritingSeg.w0 + 20, 640 - 160);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan application pipeline</CardTitle>
        <CardDescription>Total Applications through Released, live counts. Declined branches off after Underwriting.</CardDescription>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 640 ${svgHeight}`} role="img" style={{ width: '100%', height: 'auto', maxWidth: 640 }}>
          <title>Loan application pipeline funnel</title>
          <desc>
            {stages.map((s) => `${s.label} ${s.value}`).join(', ')}. Declined {pipeline.declined} ({declinedPct}% of total), branches off to the
            side.
          </desc>
          {segments.map((s) => (
            <g key={s.key}>
              <path d={`M ${cx - s.w0},${s.y0} L ${cx + s.w0},${s.y0} L ${cx + s.w1},${s.y1} L ${cx - s.w1},${s.y1} Z`} fill={s.style.fill} />
              <text x={cx} y={(s.y0 + s.y1) / 2 - 4} textAnchor="middle" fontSize="13" fontWeight="500" fill={s.style.text}>
                {s.label}
              </text>
              <text x={cx} y={(s.y0 + s.y1) / 2 + 14} textAnchor="middle" fontSize="16" fontWeight="500" fill={s.style.text}>
                {s.value}
                {s.pctOfTotal !== null ? ` · ${s.pctOfTotal}%` : ''}
              </text>
            </g>
          ))}
          <path
            d={`M ${cx + underwritingSeg.w0 + 20},${declinedBranchY} C ${declinedBoxX + 60},${declinedBranchY} ${declinedBoxX + 60},${declinedBranchY + 60} ${declinedBoxX + 75},${declinedBranchY + 60}`}
            fill="none"
            stroke="#F09595"
            strokeWidth="2"
          />
          <rect x={declinedBoxX} y={declinedBranchY + 40} width="150" height="46" rx="4" fill="#FCEBEB" />
          <text x={declinedBoxX + 75} y={declinedBranchY + 60} textAnchor="middle" fontSize="12" fontWeight="500" fill="#791F1F">
            Declined
          </text>
          <text x={declinedBoxX + 75} y={declinedBranchY + 78} textAnchor="middle" fontSize="14" fontWeight="500" fill="#791F1F">
            {pipeline.declined} · {declinedPct}% of total
          </text>
        </svg>
      </CardContent>
    </Card>
  );
}

/**
 * 2026-07-23 (user request - "meron na tayong drag sa card"): drag handle for the 4 top stat
 * cards, replacing Settings > Appearance > Dashboard Layout's old up/down-arrow reorder buttons
 * (still keeps hide/show + density + reset there - only the reorder mechanism moved here). Not
 * `SortableSection` (used by LoanDetailPage) - that component pins its handle to the left with a
 * full-width translate-out, which only makes sense for a vertical stack of full-width sections.
 * These cards sit in a `sm:grid-cols-2 lg:grid-cols-4` grid, so the handle is an inline overlay in
 * the card's own top-right corner instead - it stays inside the card regardless of grid position.
 *
 * 2026-07-23 v2: always-visible, not hover-reveal (`opacity-0 group-hover:opacity-100`) - user
 * testing found the hover-only handle effectively undiscoverable (a 24x24px hit target that's
 * fully invisible until the pointer lands exactly on it gives no hint it exists). Dimmed by
 * default, full opacity on hover/focus for affordance, same as every other icon-only control in
 * this app (see the sidebar/topbar icon buttons) rather than a novel hide-until-hover pattern.
 *
 * 2026-07-23 v3: moved from the top-RIGHT corner to top-LEFT - `SummaryCard`'s own topic icon
 * (Landmark/Banknote/AlertOctagon/TrendingUp) already lives in the header's top-right via
 * `justify-between`, so the two icons visually collided there. Top-left only has the card title
 * text, which starts well clear of an 8px-inset 24px handle.
 *
 * 2026-07-23 v4: `h-full [&>*]:h-full` - before this wrapper existed, the grid's direct child was
 * the `Card` itself (passed through a bare `React.Fragment`), so CSS grid's default
 * `align-items: stretch` made every card match the row's tallest sibling automatically. Now the
 * grid's direct child is this wrapper `div`, which stretches per grid rules, but the `Card` inside
 * it doesn't inherit that height on its own - cards with less content (e.g. no trend badge, a
 * one-line hint) rendered visibly shorter than taller siblings. `h-full` makes the wrapper fill the
 * stretched cell; `[&>*]:h-full` forces the `Card` child to fill the wrapper in turn, without
 * having to add a height prop to `SummaryCard` itself.
 */
function DraggableStatCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { dragReorderEnabled } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !dragReorderEnabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative h-full [&>*]:h-full', isDragging && 'z-10 opacity-70')}
    >
      {dragReorderEnabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder this card"
          className="absolute left-1 top-1.5 z-10 flex h-5 w-5 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      {children}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  onClick,
  trend,
  compact = false,
  highlight = false,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'destructive';
  onClick?: () => void;
  /** 2026-07-12: rolling 30-day (Total Active Loans) / vs-last-month (Collections) — omitted entirely, not shown as "0%", when the backend can't compute a reliable baseline (`changePercent: null`, e.g. Overdue Accounts, or a zero previous-period baseline). */
  trend?: { changePercent: number | null; label: string };
  /** Settings > Appearance > Dashboard Layout "Compact" density preference (2026-07-17) - tighter
   * padding and a smaller value figure so more cards fit above the fold. */
  compact?: boolean;
  /** 2026-07-23 (user request, "more advance and sophisticated" color direction "C"): reserves the
   * accent color for exactly one "hero" card instead of spraying success/destructive-tinted color
   * across every stat. Uses `--primary` (not a hardcoded hex) so it still tracks whichever Theme
   * Color preset is active in Settings > Appearance, in both light and dark mode. */
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        onClick && 'cursor-pointer transition-colors hover:border-primary/60',
        highlight && 'border-primary/40 bg-primary/5',
      )}
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
      <CardHeader className={cn('flex flex-row items-center justify-between space-y-0', compact ? 'pb-1' : 'pb-2')}>
        <CardTitle className={cn('text-sm font-medium', highlight ? 'text-primary' : 'text-muted-foreground')}>{title}</CardTitle>
        <Icon className={tone === 'destructive' ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-primary'} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div
            className={cn(
              compact ? 'text-xl font-bold' : 'text-2xl font-bold',
              tone === 'destructive' ? 'text-destructive' : highlight && 'text-primary',
            )}
          >
            {value}
          </div>
          {trend && trend.changePercent !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                trend.changePercent >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {trend.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.changePercent).toFixed(1)}%
            </span>
          )}
        </div>
        {!compact && <p className={cn('mt-1 text-xs', highlight ? 'text-primary/70' : 'text-muted-foreground')}>{hint}</p>}
        {!compact && trend && trend.changePercent !== null && <p className="text-[11px] text-muted-foreground">{trend.label}</p>}
      </CardContent>
    </Card>
  );
}

/** Glance-able chart + summary + link, used by the Reports preview section - sparkline only, no axes/legend/tooltip, since the full detail lives on the linked report page. */
function ReportPreviewCard({
  title,
  to,
  viewLabel,
  summary,
  children,
}: {
  title: string;
  to: string;
  viewLabel: string;
  summary?: string;
  children: React.ReactElement;
}) {
  return (
    <div className="rounded-lg border bg-secondary/20 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <Link to={to} className="text-xs text-primary hover:underline">
          {viewLabel} →
        </Link>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{summary ?? '…'}</p>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * 2026-08-05 (user request): Delinquency Rate/PAR used to render in the same teal "this is
 * clickable" color as every other metric here, including Average Loan Size and Write-off - no
 * visual distinction between "this number is bad news" and "this is just a neutral figure." These
 * thresholds are a general risk-coloring convention for portfolio-quality percentages (the higher,
 * the worse), not a sourced company policy - purely a visual affordance, not a business rule.
 */
type MetricSeverity = 'default' | 'warning' | 'destructive';

const SEVERITY_TEXT_CLASS: Record<MetricSeverity, string> = {
  default: 'text-primary',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

/** Below 10% is a healthy figure for either metric; 10-30% is worth watching; above 30% is a
 * clear red flag - a coarse, generic risk-coloring convention (not sourced from a specific
 * company policy), applied identically to Delinquency Rate and Portfolio at Risk. */
function riskPercentSeverity(percent: number): MetricSeverity {
  if (percent >= 30) return 'destructive';
  if (percent >= 10) return 'warning';
  return 'default';
}

function MetricItem({
  term,
  definition,
  value,
  onClick,
  severity = 'default',
}: {
  term: string;
  definition: string;
  value: string;
  onClick?: () => void;
  severity?: MetricSeverity;
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
          className={cn(
            'mt-1 text-xl font-bold underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring',
            SEVERITY_TEXT_CLASS[severity],
          )}
          title="View the loan accounts behind this figure"
        >
          {value}
        </button>
      ) : (
        <p className={cn('mt-1 text-xl font-bold', severity !== 'default' && SEVERITY_TEXT_CLASS[severity])}>{value}</p>
      )}
    </div>
  );
}

const ALL_CATEGORIES = 'ALL';
const EMPTY_DATE_RANGE: DateRange = { from: '', to: '' };

export function DashboardPage() {
  useLogPageView('Dashboard');
  const { t } = useLanguage();
  const { cards: cardLayout, density, reorderCards } = useDashboardLayout();
  const statCardDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleStatCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderCards(String(active.id) as DashboardCardId, String(over.id) as DashboardCardId);
  };
  const [drillDown, setDrillDown] = React.useState<LoanDrillDown | null>(null);
  const { currentAccount } = useRole();

  // 2026-08-06 (user request, mocked up first): "Good morning/afternoon/evening, {first name}" +
  // today's date + branch, above the Overview section. Computed once per page load (not live-
  // ticking) - a greeting that flips mid-glance would be more distracting than useful.
  const firstName = currentAccount.name.split(' ')[0] || currentAccount.name;
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const todayLabel = React.useMemo(
    () => new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()),
    [],
  );

  // Live portfolio-wide totals from the real backend (GET /dashboard/summary) - backs the three
  // Overview cards while the Portfolio Filter is at its default (ALL_CATEGORIES, no date range).
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiClient.get<DashboardSummary>('/dashboard/summary'),
  });

  // Reports preview (2026-07-15 user request): a glance-able summary of Loan Releases/Collections
  // with a link to the full report page, not a full replacement of those pages - same DAILY
  // endpoints LoanReportPage/CollectionReportPage already call, just the last 30 days, no filters.
  const reportsPreviewFrom = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return isoDate(d);
  }, []);
  const loanReleasesPreviewQuery = useQuery({
    queryKey: ['reports', 'loan-origination', 'DAILY', reportsPreviewFrom, 'preview'],
    queryFn: () =>
      apiClient.get<{ items: OriginationReportRow[] }>(`/reports/loan-origination?granularity=DAILY&from=${reportsPreviewFrom}`),
  });
  const collectionsPreviewQuery = useQuery({
    queryKey: ['reports', 'collections', 'DAILY', reportsPreviewFrom, 'preview'],
    queryFn: () => apiClient.get<{ items: CollectionReportRow[] }>(`/reports/collections?granularity=DAILY&from=${reportsPreviewFrom}`),
  });

  /** 2026-07-23 (user request): Collections vs. Target - "target" auto-computed as a trailing
   * 3-month rolling average of this same portfolio's own real monthly collections, replacing the
   * old hardcoded placeholder numbers (no target-setting feature exists, so this is the business
   * decision landed on: base it on recent actual performance rather than a manually-entered goal).
   * Needs 9 months of real MONTHLY collections history to show 6 months of target/actual pairs
   * (each displayed month's target draws on the 3 real months immediately before it). */
  const targetHistoryFrom = React.useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 9);
    d.setDate(1);
    return isoDate(d);
  }, []);
  const monthlyCollectionsHistoryQuery = useQuery({
    queryKey: ['reports', 'collections', 'MONTHLY', targetHistoryFrom, 'dashboard-target-history'],
    queryFn: () => apiClient.get<{ items: CollectionReportRow[] }>(`/reports/collections?granularity=MONTHLY&from=${targetHistoryFrom}`),
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
        borrowerName: borrower ? borrower.fullName : l.borrowerId,
        productType: productName,
        category: categorizeProductName(productName),
        status: l.status,
        isMatured: l.isMatured,
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

  // 2026-08-06 (user request): the Portfolio Filter UI is gone - every portfolio card below always
  // reflects the whole portfolio now, same as this filter's own "no filter selected" default
  // already behaved. Kept as constants (not state) rather than threading a "remove isFiltered
  // entirely" change through every card description below, since every one of them already reads
  // correctly with isFiltered permanently false.
  const categoryFilter = ALL_CATEGORIES;
  const dateRange = EMPTY_DATE_RANGE;
  const isFiltered = false;

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
    () => buildRealPortfolioByCategory(portfolioFilteredLoans, overdueLoanIds, maturedLoanIds),
    [portfolioFilteredLoans, overdueLoanIds, maturedLoanIds],
  );
  const filteredQualityMetrics = React.useMemo(
    () => buildRealQualityMetrics(portfolioFilteredLoans, overdueLoanIds, maturedLoanIds),
    [portfolioFilteredLoans, overdueLoanIds, maturedLoanIds],
  );
  const filteredDisbursementTrend = React.useMemo(
    () => buildRealDisbursementTrend(portfolioFilteredLoans, 6),
    [portfolioFilteredLoans],
  );
  /** 2026-07-23: real month-over-month disbursement growth (replaces the old hardcoded "+4.8%
   * sample data"), on the full portfolio-wide loan set (not scoped to the Portfolio Filter above) -
   * same "portfolio-wide by design" treatment as Collections This Month. `null` when there's no
   * prior-month disbursement to compare against (division by zero), matching the backend's own
   * collectionsThisMonth.trend.changePercent null convention.
   *
   * 2026-08-05 (user-reported bug fix): now uses `buildElapsedMatchedDisbursementComparison`
   * (elapsed-day-matched, e.g. Aug 1-5 vs Jul 1-5) instead of the old full-calendar-month compare -
   * see that function's own doc comment for why the old version was misleading. */
  const portfolioGrowthPercent = React.useMemo(() => {
    const { current, previous } = buildElapsedMatchedDisbursementComparison(allPortfolioLoans);
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }, [allPortfolioLoans]);
  const liveSummary = !isFiltered ? summaryQuery.data : undefined;
  const filteredActiveCount =
    filteredPortfolioHealth.good.count + filteredPortfolioHealth.activeInArrears.count + filteredPortfolioHealth.matured.count;
  const filteredOutstandingTotal =
    filteredPortfolioByCategory.reduce((sum, slice) => sum + slice.value, 0) ||
    filteredPortfolioHealth.good.collectionsBalance +
      filteredPortfolioHealth.activeInArrears.collectionsBalance +
      filteredPortfolioHealth.matured.collectionsBalance;

  // 2026-08-05 (user-reported bug fix): `PortfolioLoanRow.status` is the raw, legacy-migrated
  // LoanAccountStatus field - it doesn't reliably track the live good/arrears bucket a loan is
  // actually in right now (see `openVennSegment`'s identical `displayStatusOverride` and its own
  // doc comment for the full explanation - the live overdueLoanIds/maturedLoanIds computation is
  // what decided which bucket each loan is already in here). Without this override,
  // LoanDrillDownDialog's status badge falls back to that stale raw field, so a loan the Loan
  // Portfolio Health Venn correctly buckets as "Active in Arrears" could still show a green
  // "Active" badge in these drill-down lists - found via a real case where 25 of 32 live-in-arrears
  // loans still carried a stale `ACTIVE` status. "Matured" loans are left as-is - LoanStatusBadge
  // already shows "Matured" whenever `isMatured` is true, regardless of `status`.
  const overrideStatus = <T extends { status: LoanAccountStatus }>(loans: T[], status: LoanAccountStatus): T[] =>
    loans.map((loan) => ({ ...loan, status }));

  // Every active loan under the current filter (performing, in arrears, and past-maturity-but-
  // unpaid) - the denominator/drill-down set behind the filtered Total Active Loans and Average
  // Loan Size figures.
  const filteredActivePortfolioLoans = React.useMemo(
    () => [
      ...overrideStatus(filteredPortfolioHealth.good.loans, 'ACTIVE'),
      ...overrideStatus(filteredPortfolioHealth.activeInArrears.loans, 'ACTIVE_IN_ARREARS'),
      ...filteredPortfolioHealth.matured.loans,
    ],
    [filteredPortfolioHealth],
  );

  // Delinquent = overdue but still active: in arrears (overdue within term) + matured (past the
  // full term, still unpaid). This is the numerator behind the Delinquency Rate and PAR metrics.
  const filteredDelinquentLoans = React.useMemo(
    () => [...overrideStatus(filteredPortfolioHealth.activeInArrears.loans, 'ACTIVE_IN_ARREARS'), ...filteredPortfolioHealth.matured.loans],
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
  // 2026-07-23: real trailing-3-month-average target vs. real actual, portfolio-wide by design
  // (same "not affected by the Portfolio Filter" treatment as Collections Forecast below) - see
  // monthlyCollectionsHistoryQuery's own doc comment.
  const collectionsVsTarget = React.useMemo(() => {
    const byPeriod = new Map(
      (monthlyCollectionsHistoryQuery.data?.items ?? []).map((r) => [r.period, Number(r.amountCollected)]),
    );
    const now = new Date();
    const months = Array.from({ length: 9 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (8 - i), 1);
      return { month: MONTH_SHORT_NAMES[d.getMonth()]!, period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
    });
    return months.slice(3).map((m, i) => {
      const priorActuals = months.slice(i, i + 3).map((p) => byPeriod.get(p.period) ?? 0);
      const target = priorActuals.reduce((sum, v) => sum + v, 0) / priorActuals.length;
      return { month: m.month, target: round2Peso(target), actual: round2Peso(byPeriod.get(m.period) ?? 0) };
    });
  }, [monthlyCollectionsHistoryQuery.data]);

  const openDelinquentAccounts = () =>
    setDrillDown({
      title: 'Delinquent Accounts',
      description:
        'Overdue but still active - accounts in arrears (overdue within term) plus matured accounts (past the full term, still unpaid). This is the set behind the Delinquency Rate and Portfolio-at-Risk figures.' +
        (isFiltered ? ' Reflects the Portfolio Filter above.' : ''),
      loans: filteredDelinquentLoans,
    });

  const openVennSegment = (segment: PortfolioHealthSegment) => {
    // `PortfolioLoanRow.status` is the raw, legacy-migrated LoanAccountStatus field - it never
    // transitions to/from 'ACTIVE_IN_ARREARS' in this codebase, so plenty of loans the live
    // overdueLoanIds/maturedLoanIds computation correctly buckets as "good" still carry a stale
    // 'ACTIVE_IN_ARREARS' status, and vice versa. Left as-is, LoanDrillDownDialog's status badge
    // (which falls back to the raw `status` field whenever `isMatured` is false) would show
    // "Active in Arrears" badges inside the "Good" list and "Active" badges inside the "In
    // Arrears" list - contradicting the very bucket the row is listed under. Override the display
    // status to match the live bucket the loan was actually just classified into; "matured" needs
    // no override since LoanStatusBadge already shows "Matured" whenever isMatured is true,
    // regardless of `status`.
    const displayStatusOverride: Partial<Record<PortfolioHealthSegment, LoanAccountStatus>> = {
      good: 'ACTIVE',
      activeInArrears: 'ACTIVE_IN_ARREARS',
    };
    const override = displayStatusOverride[segment];
    const loans = override
      ? filteredPortfolioHealth[segment].loans.map((loan) => ({ ...loan, status: override }))
      : filteredPortfolioHealth[segment].loans;
    setDrillDown({ ...VENN_SEGMENT_META[segment], loans });
  };

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
      <div>
        <h1 className="font-serif text-2xl text-foreground">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {todayLabel} · {COMPANY_INFO.branchName} branch
        </p>
      </div>

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

      {(() => {
        const compact = density === 'compact';
        // Settings > Appearance > Dashboard Layout (2026-07-17): each officer can hide and reorder
        // these 4 cards - `cardLayout` is already in the officer's preferred display order.
        const cardById: Record<string, React.ReactNode> = {
          activeLoans: (
            <SummaryCard
              title={t('dashboard.stat.activeLoans')}
              value={liveSummary ? liveSummary.totalActiveLoans.count.toString() : filteredActiveCount.toString()}
              hint={
                liveSummary
                  ? `${formatPeso(Number(liveSummary.totalActiveLoans.outstandingPrincipalBalance))} outstanding principal`
                  : `${formatPeso(filteredOutstandingTotal)} outstanding principal`
              }
              icon={Landmark}
              compact={compact}
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
          ),
          collectionsThisMonth: (
            <SummaryCard
              title={t('dashboard.stat.collectionsThisMonth')}
              value={liveSummary ? formatPeso(Number(liveSummary.collectionsThisMonth.amount)) : formatPeso(scaledCollectionsThisMonth)}
              hint={liveSummary ? 'Live, across all branches' : isFiltered ? 'Estimated for the selected filter' : 'Across all branches'}
              icon={Banknote}
              compact={compact}
              trend={
                liveSummary
                  ? { changePercent: liveSummary.collectionsThisMonth.trend.changePercent, label: 'vs same days last month, portfolio-wide' }
                  : undefined
              }
            />
          ),
          overdueAccounts: (
            <SummaryCard
              title={t('dashboard.stat.overdueAccounts')}
              value={liveSummary ? liveSummary.overdueAccounts.count.toString() : filteredDelinquentLoans.length.toString()}
              hint={
                liveSummary
                  ? `${formatPeso(Number(liveSummary.overdueAccounts.atRiskCollectionsBalance))} at risk (collections balance)`
                  : `${formatPeso(filteredPortfolioHealth.activeInArrears.collectionsBalance + filteredPortfolioHealth.matured.collectionsBalance)} at risk (collections balance)`
              }
              icon={AlertOctagon}
              tone="destructive"
              compact={compact}
              // 2026-08-05 (user-reported bug fix): was openVennSegment('activeInArrears') - only
              // showed the "in arrears within term" subset, silently dropping matured loans from
              // the drill-down even though the headline count (liveSummary.overdueAccounts.count)
              // already includes both (matured is a subset of the live overdueIds set - see
              // findOverdueLoanAccounts in PrismaDashboardRepository.ts). openDelinquentAccounts is
              // the existing handler that already combines both correctly.
              onClick={openDelinquentAccounts}
            />
          ),
          portfolioGrowth: (
            <SummaryCard
              title={t('dashboard.stat.portfolioGrowth')}
              value={portfolioGrowthPercent === null ? '—' : `${portfolioGrowthPercent >= 0 ? '+' : ''}${portfolioGrowthPercent.toFixed(1)}%`}
              hint={
                portfolioGrowthPercent === null
                  ? 'Not enough disbursement history yet'
                  : 'Month-over-month disbursement, portfolio-wide, same elapsed days'
              }
              icon={portfolioGrowthPercent !== null && portfolioGrowthPercent < 0 ? TrendingDown : TrendingUp}
              tone={portfolioGrowthPercent !== null && portfolioGrowthPercent < 0 ? 'destructive' : 'default'}
              compact={compact}
              highlight
            />
          ),
        };
        const visibleCards = cardLayout.filter((c) => c.visible);
        if (visibleCards.length === 0) return null;
        return (
          <DndContext sensors={statCardDndSensors} collisionDetection={closestCenter} onDragEnd={handleStatCardDragEnd}>
          <SortableContext items={visibleCards.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleCards.map((c) => (
              <DraggableStatCard key={c.id} id={c.id}>
                {cardById[c.id]}
              </DraggableStatCard>
            ))}
          </div>
          </SortableContext>
          </DndContext>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.portfolioQuality.title')}</CardTitle>
          <CardDescription>
            Industry-standard portfolio quality indicators, computed live{isFiltered ? ' against the Portfolio Filter above' : ''}.
            Hover the ⓘ for each term's definition; click a value to see the accounts behind it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <MetricItem
            term={FINANCIAL_GLOSSARY.delinquencyRate.term}
            definition={FINANCIAL_GLOSSARY.delinquencyRate.definition}
            value={`${filteredQualityMetrics.delinquencyRatePercent.toFixed(1)}%`}
            severity={riskPercentSeverity(filteredQualityMetrics.delinquencyRatePercent)}
            onClick={openDelinquentAccounts}
          />
          <MetricItem
            term={FINANCIAL_GLOSSARY.portfolioAtRisk.term}
            definition={FINANCIAL_GLOSSARY.portfolioAtRisk.definition}
            value={`${filteredQualityMetrics.portfolioAtRiskPercent.toFixed(1)}%`}
            severity={riskPercentSeverity(filteredQualityMetrics.portfolioAtRiskPercent)}
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
                  fill="hsl(var(--primary))"
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
              Monthly actual collections against a trailing 3-month average target - portfolio-wide, not affected by the Portfolio Filter above
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={collectionsVsTarget}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={pesoTooltipFormatter} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} />
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
                    stroke="hsl(var(--primary))"
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

        {summaryQuery.data && <LoanApplicationPipelineFunnel pipeline={summaryQuery.data.loanApplicationPipeline} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.reportsPreview.title')}</CardTitle>
          <CardDescription>Last 30 days - open the full report for filters, tables, and other periods.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ReportPreviewCard
            title={t('dashboard.reportsPreview.loanReleases')}
            to="/reports/loans"
            viewLabel={t('dashboard.reportsPreview.viewReport')}
            summary={
              loanReleasesPreviewQuery.data
                ? `${loanReleasesPreviewQuery.data.items.reduce((sum, r) => sum + r.loansOriginated, 0)} loans · ${formatPeso(
                    loanReleasesPreviewQuery.data.items.reduce((sum, r) => sum + Number(r.amountOriginated), 0),
                  )}`
                : undefined
            }
          >
            <LineChart data={loanReleasesPreviewQuery.data?.items ?? []}>
              <Line type="monotone" dataKey="loansOriginated" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ReportPreviewCard>

          <ReportPreviewCard
            title={t('dashboard.reportsPreview.collections')}
            to="/reports/collections"
            viewLabel={t('dashboard.reportsPreview.viewReport')}
            summary={
              collectionsPreviewQuery.data
                ? formatPeso(collectionsPreviewQuery.data.items.reduce((sum, r) => sum + Number(r.amountCollected), 0))
                : undefined
            }
          >
            <BarChart data={collectionsPreviewQuery.data?.items ?? []}>
              <Bar dataKey={(d: CollectionReportRow) => Number(d.amountCollected)} fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ReportPreviewCard>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.categoryBreakdown.title')}</CardTitle>
          <CardDescription>
            Outstanding principal across the 3 active categories (SML = Seafarer Loan sub-class) - bar length is each category's share
            of the total, colors are the Active/Past Due/Matured split - click a bar for its accounts
            {isFiltered ? ' · reflects the filter above' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPortfolioByCategory.length === 0 ? (
            <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No active loan accounts match the selected filter.
            </p>
          ) : (
            <div className="flex flex-col">
              <div className="mb-3 flex items-center gap-3 text-[10.5px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-sm bg-success" />
                  Active
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-sm bg-warning" />
                  Past Due
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-sm bg-destructive" />
                  Matured
                </span>
              </div>
              {(() => {
                const maxValue = Math.max(...filteredPortfolioByCategory.map((e) => e.value), 1);
                return filteredPortfolioByCategory.map((entry, index) => {
                  const pct = (amount: number) => (entry.value === 0 ? 0 : Math.round((amount / entry.value) * 100));
                  return (
                    <div key={entry.category} className={cn('py-2', index > 0 && 'border-t border-border')}>
                      <button
                        type="button"
                        onClick={() => openCategorySlice(entry)}
                        className="flex w-full items-baseline gap-1.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none"
                        title="View the loan accounts in this category"
                      >
                        <span className="font-medium text-foreground">{entry.category}</span>
                        <span className="text-[10.5px] text-muted-foreground">({entry.loans.length})</span>
                        <span className="ml-auto tabular-nums font-semibold text-foreground">{formatPeso(entry.value)}</span>
                      </button>
                      <div className="mt-1.5" style={{ width: `${(entry.value / maxValue) * 100}%` }}>
                        <div className="flex h-3.5 overflow-hidden rounded">
                          <div className="h-full bg-success" style={{ width: `${pct(entry.active)}%` }} />
                          <div className="h-full bg-warning" style={{ width: `${pct(entry.pastDue)}%` }} />
                          <div className="h-full bg-destructive" style={{ width: `${pct(entry.matured)}%` }} />
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] tabular-nums">
                        <span className="text-success">
                          <b className="font-semibold">{pct(entry.active)}%</b> Active ({entry.activeCount}){' '}
                          <span className="opacity-80">· {formatPeso(entry.active)}</span>
                        </span>
                        <span className="text-warning">
                          <b className="font-semibold">{pct(entry.pastDue)}%</b> Past Due ({entry.pastDueCount}){' '}
                          <span className="opacity-80">· {formatPeso(entry.pastDue)}</span>
                        </span>
                        <span className="text-destructive">
                          <b className="font-semibold">{pct(entry.matured)}%</b> Matured ({entry.maturedCount}){' '}
                          <span className="opacity-80">· {formatPeso(entry.matured)}</span>
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
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
          <div className="flex flex-col gap-3">
            {PORTFOLIO_HEALTH_PLANS.map((plan) => {
              const segmentCount = filteredPortfolioHealth[plan.key as 'good' | 'activeInArrears' | 'matured'].count;
              return (
                <div key={plan.key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <plan.icon className={`h-4 w-4 ${plan.iconClass}`} />
                      <span className="text-sm font-semibold">{plan.title}</span>
                    </div>
                    <Badge variant={plan.badgeVariant}>
                      {segmentCount} {plan.segment}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{plan.body}</p>
                </div>
              );
            })}
          </div>
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
            Computed by the LMS from this portfolio's real Good/Arrears/Matured segment counts above - a deterministic rule-based
            grouping, not an external AI model. The Loan Officer/Collector still makes the final call.
          </p>
        </CardContent>
      </Card>
      </div>

      <LoanDrillDownDialog drillDown={drillDown} onClose={() => setDrillDown(null)} />

      <RecentSystemActivityPanel />
    </div>
  );
}
