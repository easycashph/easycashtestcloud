import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ReminderSettings } from '@/lib/reminderSettingsApiTypes';
import { cn } from '@/lib/utils';
import { MemberListPage } from '@/pages/MemberListPage';
import { LoanProductsPage } from '@/pages/LoanProductsPage';
import { ActivityLogPage } from '@/pages/ActivityLogPage';

/** 2026-07-18: temporarily prevented anyone from accidentally toggling these switches on via the
 * UI while content/test sends were still being verified. 2026-07-23 (user request): unlocked -
 * both channels still default OFF (backend `ReminderSettings` row default, untouched by this
 * change), so nothing starts sending automatically just because the switch is clickable again. */
const REMINDER_TOGGLES_LOCKED = false;

type SystemTab = 'reminders' | 'members' | 'products' | 'activity-logs';
const SYSTEM_TABS: SystemTab[] = ['reminders', 'members', 'products', 'activity-logs'];

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
    mutationFn: (body: { smsEnabled?: boolean; emailEnabled?: boolean }) => apiClient.patch<ReminderSettings>('/reminder-settings', body),
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
            <Lock className="h-4 w-4 shrink-0" /> Toggles are temporarily locked to prevent accidental enabling - by MIS - Nomer.
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
 * Administration > System (2026-07-20 user request): a single Administration hub page, folding in
 * what used to be three separate top-level Administration entries - User Accounts, Loan Products,
 * and Activity Logs - as tabs alongside the Payment reminders switches (moved here earlier the same
 * day from Configuration > Settings). Each embedded page keeps its own internal access gate exactly
 * as before (`MemberListPage`/`LoanProductsPage` stay viewable by every role, only editing is
 * MIS-only; `ActivityLogPage` is MIS-only end to end) - this page itself is not gated as a whole, so
 * that visibility doesn't regress for non-MIS roles who could already see Members/Loan Products.
 * `?tab=` supports deep-linking (e.g. `RecentActivityPanel`'s "See all" link into Activity Logs).
 * Product Types (rename the Loan Products catalog's category labels) lived here briefly
 * (2026-07-20) and was moved into the Loan Products tab itself as its own sub-tab, per user
 * request - it's specifically about Loan Products, not a platform-wide System setting.
 */
export function SystemPage() {
  useLogPageView('System');
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = React.useState<SystemTab>(
    initialTab && (SYSTEM_TABS as string[]).includes(initialTab) ? (initialTab as SystemTab) : 'reminders',
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">System</h2>
        <p className="text-sm text-muted-foreground">Platform-wide switches, staff accounts, loan products, and the audit trail.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SystemTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="members">User Accounts</TabsTrigger>
          <TabsTrigger value="products">Loan Products</TabsTrigger>
          <TabsTrigger value="activity-logs">Activity Logs</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'reminders' && <ReminderSettingsCard />}
      {tab === 'members' && <MemberListPage />}
      {tab === 'products' && <LoanProductsPage />}
      {tab === 'activity-logs' && <ActivityLogPage />}
    </div>
  );
}
