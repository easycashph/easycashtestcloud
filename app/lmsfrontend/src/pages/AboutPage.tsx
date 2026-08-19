import { CheckCircle2, Code2, Smartphone, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLogPageView } from '@/lib/activityLog';
import { PreviewFooterNote } from '@/components/PreviewBanner';
import {
  LMS_ABOUT_FACTS,
  LMS_ABOUT_SECTIONS,
  LMS_APP_NAME,
  LMS_CHANGELOG,
  LMS_CLIENT_PORTAL,
  LMS_COMPANY,
  LMS_DEV_TEAM_MEMBERS,
  LMS_DEVELOPER_TEAM,
  LMS_VERSION,
  PORTAL_CHANGELOG,
  PORTAL_UPDATED_ON,
  PORTAL_VERSION,
} from '@/lib/lmsVersion';

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

      {/* Developer team */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Code2 className="h-4 w-4 text-primary" />
          <CardTitle>Developer Team - {LMS_DEVELOPER_TEAM}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {LMS_DEV_TEAM_MEMBERS.map((member) => (
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
        <CardContent className="space-y-6">
          {LMS_CHANGELOG.map((entry, index) => (
            <div key={entry.version} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Version {entry.version}</span>
                {index === 0 && <Badge variant="success">Current</Badge>}
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ul className="space-y-1.5 border-l-2 border-border pl-4">
                {entry.highlights.map((h) => (
                  <li key={h} className="text-sm text-muted-foreground">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground">Last updated {PORTAL_UPDATED_ON}.</p>
          {PORTAL_CHANGELOG.map((entry, index) => (
            <div key={entry.version} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Version {entry.version}</span>
                {index === 0 && <Badge variant="success">Current</Badge>}
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ul className="space-y-1.5 border-l-2 border-border pl-4">
                {entry.highlights.map((h) => (
                  <li key={h} className="text-sm text-muted-foreground">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 2026-07-23 bug fix: this used to be its own hardcoded paragraph claiming "sample data...
          not connected to live systems" - stale since the 2026-07-12 mock-removal pass, and
          drifted out of sync with the accurate, actively-maintained disclosure already shown
          platform-wide (PreviewBanner.tsx). Reusing that single source of truth here instead of
          maintaining a second, separately-worded copy that can go stale again. */}
      <PreviewFooterNote />
    </div>
  );
}
