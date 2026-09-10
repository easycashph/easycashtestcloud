import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AuditLog } from '@/lib/auditLogApiTypes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ReminderSettings } from '@/lib/reminderSettingsApiTypes';
import type { SecuritySettings } from '@/lib/securitySettingsApiTypes';
import { cn } from '@/lib/utils';
import { MemberListPage } from '@/pages/MemberListPage';
import { LoanProductsPage } from '@/pages/LoanProductsPage';
import { ActivityLogPage } from '@/pages/ActivityLogPage';
import { DocumentTemplatesTab } from '@/pages/DocumentTemplatesTab';
import { AnnouncementsTab } from '@/pages/AnnouncementsTab';
import { BulkExportsPage } from '@/pages/BulkExportsPage';

/** 2026-07-18: temporarily prevented anyone from accidentally toggling these switches on via the
 * UI while content/test sends were still being verified. 2026-07-23 (user request): unlocked -
 * both channels still default OFF (backend `ReminderSettings` row default, untouched by this
 * change), so nothing starts sending automatically just because the switch is clickable again.
 * 2026-07-23 (user request, later same day): re-locked - same reasoning as the original lock,
 * prevent an accidental click from flipping either channel on/off. Whatever on/off state each
 * channel is in right now is untouched by this - it only blocks further clicks via the UI. */
const REMINDER_TOGGLES_LOCKED = true;

type SystemTab = 'reminders' | 'members' | 'products' | 'documents' | 'announcements' | 'activity-logs' | 'exports' | 'security';
const SYSTEM_TABS: SystemTab[] = [
  'reminders',
  'members',
  'products',
  'documents',
  'announcements',
  'activity-logs',
  'exports',
  'security',
];

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Settings > System > Messaging & Alerts (2026-07-29 user request) - "who toggled which switch,
 * and when" for the reminder-settings row above, backed by the same MIS-only `GET /audit-logs` the
 * full Activity Logs tab uses, filtered to this use case's own `TOGGLE_REMINDER_SETTING` entries
 * (written by `UpdateReminderSettingsUseCase`, one entry per toggle that actually changed). Shows
 * previousValue/newValue since this whole card is already MIS-only, unlike the all-roles
 * `RecentSystemActivityPanel` which deliberately omits that detail. */
function ReminderSettingsActivityLog() {
  const { canManageReminderSettings } = useRole();

  const logsQuery = useQuery({
    queryKey: ['audit-logs', 'ReminderSettings', 5],
    queryFn: () =>
      apiClient.get<{ items: AuditLog[] }>('/audit-logs?entityType=ReminderSettings&limit=5'),
    enabled: canManageReminderSettings,
  });

  if (!canManageReminderSettings) return null;

  const logs = logsQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Activity log</CardTitle>
          <CardDescription>Who changed which toggle above, and when.</CardDescription>
        </div>
        <Link
          to="/admin/system?tab=activity-logs"
          className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {logsQuery.isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No toggle changes recorded yet.</p>
        ) : (
          <ul>
            {logs.map((log, index) => {
              const prev = log.previousValue as { label?: string; value?: boolean } | null;
              const next = log.newValue as { label?: string; value?: boolean } | null;
              const label = next?.label ?? prev?.label ?? log.entityId;
              const turnedOn = Boolean(next?.value);
              return (
                <li key={log.id} className={`flex items-start gap-3 py-2.5 ${index > 0 ? 'border-t' : ''}`}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                    {initials(log.userName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{log.userName ?? 'Unknown user'}</span> turned{' '}
                      <span className="font-medium">{label}</span> {turnedOn ? 'on' : 'off'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={prev?.value ? 'success' : 'warning'} className="px-1.5 py-0 text-[10px]">
                        {prev?.value ? 'On' : 'Off'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">&rarr;</span>
                      <Badge variant={next?.value ? 'success' : 'warning'} className="px-1.5 py-0 text-[10px]">
                        {next?.value ? 'On' : 'Off'}
                      </Badge>
                      <span className="ml-1 text-[10.5px] text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReminderSettingsCard() {
  const { canManageReminderSettings, currentAccount } = useRole();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: () => apiClient.get<ReminderSettings>('/reminder-settings'),
    enabled: canManageReminderSettings,
  });

  const updateMutation = useMutation({
    mutationFn: (body: {
      smsEnabled?: boolean;
      emailEnabled?: boolean;
      signingSmsEnabled?: boolean;
      signingEmailEnabled?: boolean;
      portalEmailEnabled?: boolean;
      portalSmsEnabled?: boolean;
    }) => apiClient.patch<ReminderSettings>('/reminder-settings', body),
    onSuccess: (settings) => {
      queryClient.setQueryData(['reminder-settings'], settings);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update reminder settings.'),
  });

  if (!canManageReminderSettings) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Restricted to MIS accounts</p>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
          </p>
        </CardContent>
      </Card>
    );
  }

  const settings = settingsQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment reminders</CardTitle>
        <CardDescription>Turn on automated sending once you've verified the content and test sends.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 divide-y rounded-md border">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {REMINDER_TOGGLES_LOCKED && (
          <div className="flex items-center gap-2 rounded-md bg-warning/20 p-3 text-xs text-warning-foreground">
            <Lock className="h-4 w-4 shrink-0" /> Toggles are temporarily locked to prevent accidental enabling.
          </div>
        )}
        <div className={cn('flex items-center justify-between gap-3 p-3', REMINDER_TOGGLES_LOCKED && 'opacity-60')}>
          <div>
            <p className="text-sm font-medium">SMS reminders</p>
            <p className="text-xs text-muted-foreground">Sent via M360/Globe to borrowers' mobile numbers</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings?.smsEnabled ? 'success' : 'warning'}>{settings?.smsEnabled ? 'On' : 'Off'}</Badge>
            <Switch
              checked={settings?.smsEnabled ?? false}
              disabled={REMINDER_TOGGLES_LOCKED || settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ smsEnabled: checked })}
              aria-label="Toggle SMS reminders"
            />
          </div>
        </div>
        <div className={cn('flex items-center justify-between gap-3 p-3', REMINDER_TOGGLES_LOCKED && 'opacity-60')}>
          <div>
            <p className="text-sm font-medium">Email reminders</p>
            <p className="text-xs text-muted-foreground">Sent from collections@easycash.ph to borrowers' email</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings?.emailEnabled ? 'success' : 'warning'}>{settings?.emailEnabled ? 'On' : 'Off'}</Badge>
            <Switch
              checked={settings?.emailEnabled ?? false}
              disabled={REMINDER_TOGGLES_LOCKED || settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ emailEnabled: checked })}
              aria-label="Toggle Email reminders"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-medium">E-signature SMS</p>
            <p className="text-xs text-muted-foreground">
              Sent via M360/Globe for signing links and OTP codes - separate from Payment reminders above.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings?.signingSmsEnabled ? 'success' : 'warning'}>{settings?.signingSmsEnabled ? 'On' : 'Off'}</Badge>
            <Switch
              checked={settings?.signingSmsEnabled ?? false}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ signingSmsEnabled: checked })}
              aria-label="Toggle e-signature SMS"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-medium">E-signature Email</p>
            <p className="text-xs text-muted-foreground">
              Alternative to E-signature SMS above - some Smart-network numbers silently filter link-containing SMS.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings?.signingEmailEnabled ? 'success' : 'warning'}>{settings?.signingEmailEnabled ? 'On' : 'Off'}</Badge>
            <Switch
              checked={settings?.signingEmailEnabled ?? false}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ signingEmailEnabled: checked })}
              aria-label="Toggle e-signature email"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-medium">Portal email verification</p>
            <p className="text-xs text-muted-foreground">
              Easycash Portal signup/password-reset OTP email - separate from staff 2FA, which always uses its own delivery flags.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings?.portalEmailEnabled ? 'success' : 'warning'}>{settings?.portalEmailEnabled ? 'On' : 'Off'}</Badge>
            <Switch
              checked={settings?.portalEmailEnabled ?? false}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ portalEmailEnabled: checked })}
              aria-label="Toggle Portal email verification"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-medium">Portal SMS verification</p>
            <p className="text-xs text-muted-foreground">
              Easycash Portal signup/password-reset OTP SMS - separate from staff 2FA, which always uses its own delivery flags.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings?.portalSmsEnabled ? 'success' : 'warning'}>{settings?.portalSmsEnabled ? 'On' : 'Off'}</Badge>
            <Switch
              checked={settings?.portalSmsEnabled ?? false}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ portalSmsEnabled: checked })}
              aria-label="Toggle Portal SMS verification"
            />
          </div>
        </div>
      </CardContent>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">
          Test sends (the manual scripts) still work regardless of these switches - this only controls the automated daily job.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * System > Security (2026-08-28 user request) - a single MIS-only switch: "Require 2FA for all
 * users". Turning it on doesn't touch any account directly (never force-flips `twoFactorEnabled`
 * for anyone) - `RoleProvider` blocks any account without 2FA behind `ForceTwoFactorSetupModal` the
 * next time it loads or refetches `/auth/me`, and only their own successful OTP confirmation ever
 * turns their `twoFactorEnabled` on. Mirrors `ReminderSettingsCard`'s own structure exactly.
 */
function TwoFactorEnforcementCard() {
  const { canEnforceTwoFactor, currentAccount } = useRole();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['security-settings'],
    queryFn: () => apiClient.get<SecuritySettings>('/security-settings'),
    enabled: canEnforceTwoFactor,
  });

  const updateMutation = useMutation({
    mutationFn: (body: { enforceTwoFactorForAllUsers: boolean }) => apiClient.patch<SecuritySettings>('/security-settings', body),
    onSuccess: (settings) => {
      queryClient.setQueryData(['security-settings'], settings);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update security settings.'),
  });

  if (!canEnforceTwoFactor) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Restricted to MIS accounts</p>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
          </p>
        </CardContent>
      </Card>
    );
  }

  const settings = settingsQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>Control platform-wide security requirements for every staff account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 divide-y rounded-md border">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-medium">Require 2FA for all users</p>
            <p className="text-xs text-muted-foreground">
              Any account without two-factor authentication enabled will be required to set it up (their own choice of email or SMS)
              before they can use the LMS again.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings?.enforceTwoFactorForAllUsers ? 'success' : 'warning'}>
              {settings?.enforceTwoFactorForAllUsers ? 'On' : 'Off'}
            </Badge>
            <Switch
              checked={settings?.enforceTwoFactorForAllUsers ?? false}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ enforceTwoFactorForAllUsers: checked })}
              aria-label="Toggle require 2FA for all users"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Administration > System (2026-07-20 user request): a single Administration hub page, folding in
 * what used to be three separate top-level Administration entries - User Accounts, Loan Products,
 * and Activity Logs - as tabs alongside the Payment reminders switches (moved here earlier the same
 * day from Configuration > Settings). Each embedded page keeps its own internal access gate exactly
 * as before (`MemberListPage`/`LoanProductsPage` stay viewable by every role, only editing is
 * MIS-only; `ActivityLogPage` is MIS-only end to end).
 * `?tab=` supports deep-linking (e.g. `RecentActivityPanel`'s "See all" link into Activity Logs).
 * Product Types (rename the Loan Products catalog's category labels) lived here briefly
 * (2026-07-20) and was moved into the Loan Products tab itself as its own sub-tab, per user
 * request - it's specifically about Loan Products, not a platform-wide System setting.
 *
 * 2026-08-06 (user request, supersedes the "not gated as a whole" note above): the whole page is
 * now MIS-only - the sidebar link is already hidden for every other role
 * (`AppLayout.tsx`'s `NAV_VISIBILITY`), and this guard covers direct navigation by URL. This IS a
 * visibility regression for the "Members/Loan Products stay viewable by every role" case the
 * original design deliberately preserved - accepted per this explicit, later request.
 */
export function SystemPage() {
  useLogPageView('System');
  const [searchParams] = useSearchParams();
  const { currentAccount } = useRole();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = React.useState<SystemTab>(
    initialTab && (SYSTEM_TABS as string[]).includes(initialTab) ? (initialTab as SystemTab) : 'reminders',
  );

  if (!currentAccount.roles.includes('MIS') && !currentAccount.roles.includes('Super Admin')) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Restricted to MIS/Super Admin accounts</p>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">System</h2>
        <p className="text-sm text-muted-foreground">Platform-wide switches, staff accounts, loan products, and the audit trail.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SystemTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-8">
          <TabsTrigger value="reminders">Messaging & Alerts</TabsTrigger>
          <TabsTrigger value="members">User Accounts</TabsTrigger>
          <TabsTrigger value="products">Loan Products</TabsTrigger>
          <TabsTrigger value="documents">Document Templates</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="activity-logs">Activity Logs</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'reminders' && (
        <div className="space-y-6">
          <ReminderSettingsCard />
          <ReminderSettingsActivityLog />
        </div>
      )}
      {tab === 'members' && <MemberListPage />}
      {tab === 'products' && <LoanProductsPage />}
      {tab === 'documents' && <DocumentTemplatesTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'activity-logs' && <ActivityLogPage />}
      {tab === 'exports' && <BulkExportsPage embedded />}
      {tab === 'security' && <TwoFactorEnforcementCard />}
    </div>
  );
}
