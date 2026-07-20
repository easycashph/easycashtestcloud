import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ReminderSettings } from '@/lib/reminderSettingsApiTypes';
import { cn } from '@/lib/utils';

/** 2026-07-18 user request: temporarily prevent anyone from accidentally toggling these switches
 * on via the UI, without touching the backend gate or default state. UI-only (a direct API call
 * would still work) - flip back to `false` once ready to allow toggling again. */
const REMINDER_TOGGLES_LOCKED = true;

/**
 * Administration > System (moved 2026-07-20 from Configuration > Settings' "System" tab, per user
 * request, to its own Administration page - same MIS-only gate as Activity Logs, User Accounts).
 * Content unchanged: the SMS/Email payment reminder master switches (`GET`/`PATCH
 * /reminder-settings`, see `docs/SESSION_LOG_2026-07-18_reminder_settings_toggle.md`).
 */
export function SystemPage() {
  useLogPageView('System');
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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">System</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Restricted to MIS accounts</p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings = settingsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">System</h2>
        <p className="text-sm text-muted-foreground">Platform-wide switches - MIS only.</p>
      </div>

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
    </div>
  );
}
