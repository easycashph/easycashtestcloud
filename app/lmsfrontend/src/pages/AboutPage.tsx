import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Code2, GitCommitHorizontal, Smartphone, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLogPageView } from '@/lib/activityLog';
import { cn } from '@/lib/utils';
import { fetchBackendBuildInfo, fetchFrontendBuildInfo, type BuildInfo } from '@/lib/buildInfo';
import {
  LMS_ABOUT_FACTS,
  LMS_ABOUT_SECTIONS,
  LMS_APP_NAME,
  LMS_CHANGELOG,
  LMS_CLIENT_PORTAL,
  LMS_COMPANY,
  LMS_DEV_TEAM_MEMBERS,
  LMS_DEVELOPER_TEAM,
  LMS_PERMANENT_CREDIT,
  LMS_VERSION,
  PORTAL_CHANGELOG,
  PORTAL_UPDATED_ON,
  PORTAL_VERSION,
  type LmsChangelogEntry,
} from '@/lib/lmsVersion';

// Always includes LMS_PERMANENT_CREDIT first (2026-08-20, Jomer Biason's explicit instruction -
// see that constant's own doc comment) - deduped by name so it doesn't double up while he's still
// on the current roster below.
const DEVELOPER_TEAM_DISPLAY = [
  LMS_PERMANENT_CREDIT,
  ...LMS_DEV_TEAM_MEMBERS.filter((m) => m.name !== LMS_PERMANENT_CREDIT.name),
];

const HELPS_YOU = [
  'Originate and service loans with configurable products, interest, fees, and penalties',
  'Review online loan applications with a system-computed risk summary and decision scoring',
  'Record payments and run automated collection reminders',
  'Track portfolio health - good, in-arrears, and matured accounts',
  'Read income and credit-loss figures, delinquency rate, and portfolio at risk at a glance',
  'Drill from any chart or metric down to the exact loan accounts behind it',
  'Generate and organize the official loan documents per account',
  'Keep an audit trail of who did what, with role-based access per staff member',
];

export function AboutPage() {
  useLogPageView('About');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">About</h2>
        <p className="text-sm text-muted-foreground">Version information and release history for the {LMS_APP_NAME}.</p>
      </div>

      {/* Header - app identity */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
          <img
            src="/logo-easycash.png"
            alt="Easycash logo"
            className="h-20 w-20 shrink-0 rounded-2xl border bg-white object-contain p-2 shadow-sm"
          />
          <div>
            <h3 className="text-xl font-semibold">{LMS_APP_NAME}</h3>
            <p className="text-sm text-muted-foreground">by {LMS_COMPANY}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge>Version {LMS_VERSION}</Badge>
              <Badge variant="warning">Preview Build</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About this app */}
      <Card>
        <CardHeader>
          <CardTitle>About this app</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The {LMS_APP_NAME} is {LMS_COMPANY}&apos;s enterprise Loan Management System - one place to originate and service loans,
            review online applications, record payments, drive collections, and see the health of the whole portfolio. It is built to
            preserve the company&apos;s validated business rules while improving security, performance, and day-to-day operation, and to
            grow into the customer self-service portal and mobile app in the future.
          </p>

          {LMS_ABOUT_SECTIONS.map((section) => (
            <div key={section.heading} className="space-y-1.5">
              <p className="text-xs font-semibold tracking-wider text-primary">{section.heading}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </div>
          ))}

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">The platform helps you:</p>
            <ul className="space-y-1.5">
              {HELPS_YOU.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* App facts grid */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {LMS_ABOUT_FACTS.map((fact) => (
              <div key={fact.label} className="flex flex-col">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Build Info - which commit is actually running on this machine's frontend/backend */}
      <BuildInfoCard />

      {/* Developer team */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Code2 className="h-4 w-4 text-primary" />
          <CardTitle>Developer Team - {LMS_DEVELOPER_TEAM}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DEVELOPER_TEAM_DISPLAY.map((member) => (
              <li key={member.name} className="rounded-md border p-3">
                <p className="text-sm font-semibold">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
                {member.note && <p className="mt-1 text-xs text-muted-foreground">{member.note}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Client Portal - LIVE since 2026-08-19 (see LMS_CLIENT_PORTAL's own doc comment); this
          card used to describe it as a future, not-yet-built product. */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Smartphone className="h-4 w-4 text-primary" />
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {LMS_CLIENT_PORTAL.androidAppName}
              <Badge variant="success">{LMS_CLIENT_PORTAL.status}</Badge>
              <Badge>Version {PORTAL_VERSION}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-relaxed text-muted-foreground">{LMS_CLIENT_PORTAL.description}</p>
          <p className="text-xs text-muted-foreground">
            Website: <span className="font-medium text-foreground">{LMS_CLIENT_PORTAL.website}</span>
          </p>
        </CardContent>
      </Card>

      {/* Changelog */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>What&apos;s New - Changelog</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangelogTimeline entries={LMS_CHANGELOG} />
        </CardContent>
      </Card>

      {/* Portal Changelog (2026-08-19 user request) - the client-facing Portal's own release
          history, shown alongside the LMS's so a stakeholder sees the whole platform's history
          in one place, not just the internal staff app. */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="flex flex-wrap items-center gap-2">
            Easycash Portal - Changelog
            <Badge variant="outline">v{PORTAL_VERSION}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">Last updated {PORTAL_UPDATED_ON}.</p>
          <ChangelogTimeline entries={PORTAL_CHANGELOG} />
        </CardContent>
      </Card>

      {/* 2026-08-20 bug fix: this page used to render its own <PreviewFooterNote /> here, on top of
          the one AppLayout.tsx already renders after every page's <Outlet /> - the "Internal
          Preview Build..." disclosure was showing twice in a row on this page specifically.
          AppLayout's copy already covers this page; nothing else needed here. */}
    </div>
  );
}

/**
 * 2026-08-30 (user request, "may sanity check ba tayo?"): this platform runs as three separate,
 * independently-deployed Docker stacks (Office Server PC, Macbook Nomer, Laptop Nomer) - so a
 * dashboard number can look "wrong" on one machine simply because that machine is running older
 * code, not because its data is wrong. This card surfaces exactly which commit each half (frontend
 * bundle, backend server) is actually running, right on this machine, so that question can be
 * answered by looking at a screen instead of by re-deriving the figure from raw SQL. See
 * `buildInfo.ts` / `PrismaDashboardRepository`'s sibling `shared/config/buildInfo.ts` for how the
 * commit is captured (`scripts/write-build-info.ps1`/`.sh`, run right before every Docker rebuild).
 */
function BuildInfoCard() {
  const frontendQuery = useQuery({ queryKey: ['build-info', 'frontend'], queryFn: fetchFrontendBuildInfo, staleTime: 60_000 });
  const backendQuery = useQuery({ queryKey: ['build-info', 'backend'], queryFn: fetchBackendBuildInfo, staleTime: 60_000 });

  const frontend = frontendQuery.data;
  const backend = backendQuery.data;
  const isLoading = frontendQuery.isLoading || backendQuery.isLoading;
  const matches = !isLoading && !!frontend && !!backend && frontend.commit !== 'unknown' && frontend.commit === backend.commit;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <GitCommitHorizontal className="h-4 w-4 text-primary" />
          <CardTitle>Build Info</CardTitle>
        </div>
        {!isLoading && (
          <Badge variant={matches ? 'success' : 'warning'}>{matches ? 'Frontend/backend in sync' : 'Version mismatch'}</Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          What&apos;s actually running on <span className="font-medium text-foreground">{backend?.hostname ?? 'this machine'}</span> right
          now - useful when a figure on this machine looks different from another one, to rule out a stale deployment before suspecting the
          data itself.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <BuildInfoColumn label="Frontend (this browser session)" info={frontend} isLoading={frontendQuery.isLoading} />
          <BuildInfoColumn label="Backend" info={backend} isLoading={backendQuery.isLoading} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 2026-08-30 (user request, "pwede ba natin i simplify ito... high end, advance sophisticated"):
 * the flat changelog (every release, every highlight, always expanded) had grown to 40+ full
 * entries and made this page enormous. Redesigned as a collapsed, one-line-per-release timeline -
 * only the newest release opens automatically, everything else expands on click. Reads straight
 * from `LMS_CHANGELOG`/`PORTAL_CHANGELOG` exactly as before (nothing hidden or deleted, no new
 * content authored) - a new changelog entry prepended there still appears here automatically,
 * open by default as "Current".
 */
function ChangelogTimeline({ entries }: { entries: LmsChangelogEntry[] }) {
  const [openVersions, setOpenVersions] = React.useState<Set<string>>(() => new Set(entries[0] ? [entries[0].version] : []));

  const toggle = (version: string) => {
    setOpenVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  let lastMonthLabel = '';

  return (
    <div>
      {entries.map((entry, index) => {
        const firstDate = entry.days[0]?.date;
        const monthLabel = firstDate ? formatMonthLabel(firstDate) : '';
        const showMonthHeader = monthLabel !== lastMonthLabel;
        lastMonthLabel = monthLabel;
        const isOpen = openVersions.has(entry.version);
        const isPatch = /\.\d+\.[1-9]\d*$/.test(entry.version);
        const changeCount = entry.days.reduce((sum, d) => sum + d.highlights.length, 0);
        const summary = summarizeHighlight(entry.days[0]?.highlights[0] ?? '');

        return (
          <div key={entry.version}>
            {showMonthHeader && (
              <p className={cn('px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground', index !== 0 && 'pt-5')}>
                {monthLabel}
              </p>
            )}
            <button
              type="button"
              onClick={() => toggle(entry.version)}
              className="group flex w-full items-baseline justify-between gap-4 border-b py-3 text-left last:border-b-0"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{entry.version}</span>
                {isPatch && <Badge variant="outline" className="shrink-0 text-[10px] font-normal">Patch</Badge>}
                <span className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                  {summary}
                  <span className="ml-1.5 font-normal text-xs text-muted-foreground">
                    · {changeCount} change{changeCount === 1 ? '' : 's'}
                  </span>
                </span>
                {index === 0 && <Badge variant="success" className="shrink-0">Current</Badge>}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="whitespace-nowrap text-xs text-muted-foreground">{firstDate ? formatShortDate(firstDate) : ''}</span>
                <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-90 text-primary')} />
              </span>
            </button>
            {isOpen && (
              <ul className="space-y-2 py-3 pl-1 pr-2">
                {entry.days.flatMap((day) => day.highlights).map((h) => (
                  <li key={h} className="relative pl-4 text-sm text-muted-foreground">
                    <span className="absolute left-0 top-[0.6em] h-1 w-1 rounded-full bg-primary/60" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatMonthLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Derives a one-line title from a release's first highlight instead of hand-authoring 40+ extra
 * summaries - cuts at the first " - "/" — " clause (this changelog's own convention for "what,
 * then why"), else the first sentence, else a hard truncation. Pure text-shortening, not
 * fabrication - every word shown is copied verbatim from the real highlight. */
function summarizeHighlight(text: string): string {
  if (!text) return '';
  const dashMatch = text.match(/^(.*?)\s[-—]\s/);
  let candidate = dashMatch ? dashMatch[1]! : text;
  if (!dashMatch) {
    const periodIdx = candidate.indexOf('. ');
    if (periodIdx > 15 && periodIdx < 100) candidate = candidate.slice(0, periodIdx);
  }
  candidate = candidate.replace(/^["“]|["”]$/g, '').trim();
  const MAX = 72;
  if (candidate.length > MAX) {
    const cut = candidate.slice(0, MAX);
    const lastSpace = cut.lastIndexOf(' ');
    candidate = `${cut.slice(0, lastSpace > 40 ? lastSpace : MAX)}…`;
  }
  return candidate;
}

function BuildInfoColumn({ label, info, isLoading }: { label: string; info: BuildInfo | Omit<BuildInfo, 'hostname'> | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {isLoading ? (
        <p className="mt-1.5 text-sm text-muted-foreground">Loading…</p>
      ) : !info || info.commit === 'unknown' ? (
        <p className="mt-1.5 text-sm text-muted-foreground">Not available (build-info.json not generated for this deployment).</p>
      ) : (
        <div className="mt-1.5 space-y-1">
          <p className="font-mono text-sm font-semibold">{info.commit}</p>
          {info.commitMessage && <p className="text-xs text-muted-foreground">{info.commitMessage}</p>}
          {info.builtAt && (
            <p className="text-xs text-muted-foreground">
              Built {new Date(info.builtAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
