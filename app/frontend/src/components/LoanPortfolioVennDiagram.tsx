import { formatPeso } from '@/lib/utils';

export type PortfolioHealthSegment = 'good' | 'activeInArrears' | 'matured';

function accountLabel(count: number): string {
  return `${count} account${count === 1 ? '' : 's'}`;
}

interface VennBucket {
  count: number;
  collectionsBalance: number;
}

interface LoanPortfolioVennDiagramProps {
  good: VennBucket & { interestIncome: number };
  activeInArrears: VennBucket & { penaltyIncome: number; accruedRevenue: number };
  matured: VennBucket & { creditLoss: number };
  /** When provided, every diagram region and summary card becomes clickable, drilling down to that segment's loan accounts. */
  onSegmentClick?: (segment: PortfolioHealthSegment) => void;
}

const CIRCLE_A = { cx: 170, cy: 130, r: 95 };
const CIRCLE_B = { cx: 310, cy: 130, r: 95 };

export function LoanPortfolioVennDiagram({ good, activeInArrears, matured, onSegmentClick }: LoanPortfolioVennDiagramProps) {
  const clickable = Boolean(onSegmentClick);
  const shapeClass = clickable ? 'cursor-pointer' : undefined;

  function SummaryCard({
    segment,
    toneClasses,
    labelClass,
    label,
    bucket,
    metricLabel,
    metricValue,
    detail,
  }: {
    segment: PortfolioHealthSegment;
    toneClasses: string;
    labelClass: string;
    label: string;
    bucket: VennBucket;
    metricLabel: string;
    metricValue: number;
    detail: string;
  }) {
    const body = (
      <>
        <p className={`text-xs font-medium ${labelClass}`}>{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {accountLabel(bucket.count)} · {formatPeso(bucket.collectionsBalance)}
        </p>
        <p className={`mt-1 text-sm font-semibold ${labelClass}`}>
          {metricLabel}: {formatPeso(metricValue)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </>
    );
    if (!clickable) return <div className={`rounded-md border p-3 ${toneClasses}`}>{body}</div>;
    return (
      <button
        type="button"
        onClick={() => onSegmentClick?.(segment)}
        className={`rounded-md border p-3 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring ${toneClasses}`}
        title="View the loan accounts in this segment"
      >
        {body}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <svg
        viewBox="0 0 480 260"
        className="mx-auto w-full max-w-md"
        role="img"
        aria-label="Venn diagram of Good loan accounts, Active accounts in Arrears (overlap), and Matured loan accounts"
      >
        <defs>
          <clipPath id="venn-clip-b">
            <circle cx={CIRCLE_B.cx} cy={CIRCLE_B.cy} r={CIRCLE_B.r} />
          </clipPath>
        </defs>

        <circle
          cx={CIRCLE_A.cx}
          cy={CIRCLE_A.cy}
          r={CIRCLE_A.r}
          fill="hsl(var(--success))"
          fillOpacity={0.18}
          stroke="hsl(var(--success))"
          strokeWidth={1.5}
          className={shapeClass}
          onClick={() => onSegmentClick?.('good')}
        >
          <title>Good loan accounts — click to view</title>
        </circle>
        <circle
          cx={CIRCLE_B.cx}
          cy={CIRCLE_B.cy}
          r={CIRCLE_B.r}
          fill="hsl(var(--destructive))"
          fillOpacity={0.18}
          stroke="hsl(var(--destructive))"
          strokeWidth={1.5}
          className={shapeClass}
          onClick={() => onSegmentClick?.('matured')}
        >
          <title>Matured loan accounts — click to view</title>
        </circle>
        {/* Circle A clipped by circle B's bounds = the exact lens-shaped intersection, drawn on top in amber. */}
        <circle
          cx={CIRCLE_A.cx}
          cy={CIRCLE_A.cy}
          r={CIRCLE_A.r}
          fill="hsl(var(--warning))"
          fillOpacity={0.55}
          stroke="hsl(var(--warning))"
          strokeWidth={1.5}
          clipPath="url(#venn-clip-b)"
          className={shapeClass}
          onClick={() => onSegmentClick?.('activeInArrears')}
        >
          <title>Active accounts in Arrears — click to view</title>
        </circle>

        <g className="pointer-events-none select-none">
          <text x={118} y={122} textAnchor="middle" className="fill-foreground text-2xl font-bold">
            {good.count}
          </text>
          <text x={118} y={142} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            Good
          </text>

          <text x={362} y={122} textAnchor="middle" className="fill-foreground text-2xl font-bold">
            {matured.count}
          </text>
          <text x={362} y={142} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            Matured
          </text>

          <text x={240} y={128} textAnchor="middle" className="fill-foreground text-2xl font-bold">
            {activeInArrears.count}
          </text>
          <text x={240} y={146} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
            In Arrears
          </text>

          <text x={170} y={40} textAnchor="middle" className="fill-success text-sm font-semibold">
            Good Loan Accounts
          </text>
          <text x={310} y={40} textAnchor="middle" className="fill-destructive text-sm font-semibold">
            Matured Loan Accounts
          </text>
        </g>
      </svg>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          segment="good"
          toneClasses="border-success/30 bg-success/5"
          labelClass="text-success"
          label="Good"
          bucket={good}
          metricLabel="Interest Income"
          metricValue={good.interestIncome}
          detail="Interest revenue collected from performing accounts — paying on schedule, no penalty fees."
        />
        <SummaryCard
          segment="activeInArrears"
          toneClasses="border-warning/30 bg-warning/5"
          labelClass="text-warning"
          label="In Arrears"
          bucket={activeInArrears}
          metricLabel="Accrued Revenue"
          metricValue={activeInArrears.accruedRevenue}
          detail={`Accrued interest earned but not yet remitted. Still active and paying, sometimes late — plus ${formatPeso(activeInArrears.penaltyIncome)} in penalty/late-fee income on top of amortization.`}
        />
        <SummaryCard
          segment="matured"
          toneClasses="border-destructive/30 bg-destructive/5"
          labelClass="text-destructive"
          label="Matured"
          bucket={matured}
          metricLabel="Credit Loss"
          metricValue={matured.creditLoss}
          detail="Unpaid principal at risk of loss — reached the end of the full term but still unpaid. The highest-risk active segment (not the same as a settled Closed loan)."
        />
      </div>
    </div>
  );
}
