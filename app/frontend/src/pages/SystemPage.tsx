import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Lock, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ReminderSettings } from '@/lib/reminderSettingsApiTypes';
import { useProductTypeLabels } from '@/lib/productTypeLabels';
import type { ProductTypeLabel } from '@/lib/productTypeLabelApiTypes';
import { cn } from '@/lib/utils';
import { MemberListPage } from '@/pages/MemberListPage';
import { LoanProductsPage } from '@/pages/LoanProductsPage';
import { ActivityLogPage } from '@/pages/ActivityLogPage';

/** 2026-07-18 user request: temporarily prevent anyone from accidentally toggling these switches
 * on via the UI, without touching the backend gate or default state. UI-only (a direct API call
 * would still work) - flip back to `false` once ready to allow toggling again. */
const REMINDER_TOGGLES_LOCKED = true;

type SystemTab = 'reminders' | 'members' | 'products' | 'product-types' | 'activity-logs';
const SYSTEM_TABS: SystemTab[] = ['reminders', 'members', 'products', 'product-types', 'activity-logs'];

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

function ProductTypeLabelRow({ productTypeLabel, canRename }: { productTypeLabel: ProductTypeLabel; canRename: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(productTypeLabel.label);
  const [error, setError] = React.useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (label: string) => apiClient.patch<ProductTypeLabel>(`/product-type-labels/${productTypeLabel.id}`, { label }),
    onSuccess: () => {
      setEditing(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['product-type-labels'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not rename this Product Type.'),
  });

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === productTypeLabel.label) {
      setEditing(false);
      setValue(productTypeLabel.label);
      return;
    }
    updateMutation.mutate(trimmed);
  };

  return (
    <li className="space-y-1.5 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-8 text-sm" autoFocus />
            <Button type="submit" size="sm" className="h-8 shrink-0" disabled={updateMutation.isPending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => {
                setEditing(false);
                setValue(productTypeLabel.label);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <div className="text-sm">
              <span className="font-medium">{productTypeLabel.label}</span>
              {productTypeLabel.label !== productTypeLabel.canonicalKey && (
                <span className="ml-2 text-xs text-muted-foreground">was &ldquo;{productTypeLabel.canonicalKey}&rdquo;</span>
              )}
            </div>
            {canRename && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)} aria-label={`Rename ${productTypeLabel.label}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

/**
 * Administration > System > Product Types (2026-07-20 user request) - lets MIS rename the Loan
 * Products catalog's Product Type groupings (Business Loan, Salary Loan, etc.) without touching the
 * underlying name-prefix classification rule (`productTypeClassification.ts`) - only the label
 * shown to staff changes, everywhere it's displayed (Loan Products catalog, Create Loan Account's
 * and Loan Application's Product Type pickers).
 */
function ProductTypesCard() {
  const { canManageMembers } = useRole();
  const query = useProductTypeLabels();
  const productTypeLabels = query.data?.productTypeLabels ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Types</CardTitle>
        <CardDescription>
          Renames how each Loan Products category is labeled throughout the app - MIS only. The underlying grouping rule (which
          products fall under which type) is unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> Could not load Product Types. Is the backend running?
          </div>
        )}
        <ul className="space-y-2">
          {productTypeLabels.map((pt) => (
            <ProductTypeLabelRow key={pt.id} productTypeLabel={pt} canRename={canManageMembers} />
          ))}
          {productTypeLabels.length === 0 && !query.isLoading && (
            <li className="py-2 text-center text-xs text-muted-foreground">No Product Types found.</li>
          )}
        </ul>
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="members">User Accounts</TabsTrigger>
          <TabsTrigger value="products">Loan Products</TabsTrigger>
          <TabsTrigger value="product-types">Product Types</TabsTrigger>
          <TabsTrigger value="activity-logs">Activity Logs</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'reminders' && <ReminderSettingsCard />}
      {tab === 'members' && <MemberListPage />}
      {tab === 'products' && <LoanProductsPage />}
      {tab === 'product-types' && <ProductTypesCard />}
      {tab === 'activity-logs' && <ActivityLogPage />}
    </div>
  );
}
