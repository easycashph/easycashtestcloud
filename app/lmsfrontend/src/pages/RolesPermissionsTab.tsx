import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  Bot,
  FileCheck2,
  FileText,
  Landmark,
  Lock,
  PenLine,
  Phone,
  Search,
  ShieldCheck,
  Sliders,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiClient, ApiError } from '@/lib/apiClient';
import { roleFullLabel } from '@/lib/roleGlossary';
import type { ListRolesAndPermissionsResponse, Permission } from '@/lib/accessControlApiTypes';
import { cn } from '@/lib/utils';

/** Groups the flat `Permission` list by its code's module prefix (`loan_account.approve` ->
 * `loan_account`) into the same module sections the mockup showed - purely a display grouping,
 * has no backend counterpart. */
const MODULE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  loan_application: { label: 'Loan Applications', icon: FileCheck2 },
  loan_account: { label: 'Loan Accounts', icon: Landmark },
  payment: { label: 'Payments', icon: Banknote },
  penalty: { label: 'Payments', icon: Banknote },
  fees: { label: 'Payments', icon: Banknote },
  document: { label: 'Documents', icon: FileText },
  statement_of_account: { label: 'Documents', icon: FileText },
  attachment: { label: 'Documents', icon: FileText },
  esignature: { label: 'E-signature', icon: PenLine },
  borrower: { label: 'Clients', icon: Users },
  loan_product: { label: 'Loan Products', icon: Sliders },
  ai_extraction: { label: 'AI Tools', icon: Bot },
  collection: { label: 'Collection', icon: Phone },
  report: { label: 'Reports', icon: FileText },
  user: { label: 'Administration', icon: ShieldCheck },
  audit_log: { label: 'Administration', icon: ShieldCheck },
  reminder_settings: { label: 'Administration', icon: ShieldCheck },
  profile_activity_log: { label: 'Administration', icon: ShieldCheck },
};
const MODULE_ORDER = [
  'Loan Applications',
  'Loan Accounts',
  'Payments',
  'Documents',
  'E-signature',
  'Clients',
  'Loan Products',
  'AI Tools',
  'Collection',
  'Reports',
  'Administration',
];

function modulePrefix(code: string): string {
  return code.split('.')[0] ?? code;
}

function groupPermissions(permissions: Permission[], filter: string) {
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? permissions.filter((p) => (p.description ?? p.code).toLowerCase().includes(q) || moduleLabel(p.code).toLowerCase().includes(q))
    : permissions;
  const byModule = new Map<string, Permission[]>();
  for (const p of filtered) {
    const label = moduleLabel(p.code);
    const list = byModule.get(label) ?? [];
    list.push(p);
    byModule.set(label, list);
  }
  return MODULE_ORDER.map((label) => ({ label, icon: MODULE_META[Object.keys(MODULE_META).find((k) => MODULE_META[k]!.label === label)!]!.icon, permissions: byModule.get(label) ?? [] })).filter(
    (g) => g.permissions.length > 0,
  );
}

function moduleLabel(code: string): string {
  return MODULE_META[modulePrefix(code)]?.label ?? 'Other';
}

/**
 * Administration > User Accounts > Permissions (2026-08-06 user request): configurable per-role
 * access, replacing the fixed role tiers previously hard-coded in the backend. Wired to the real
 * `GET /roles-permissions` / `PATCH /roles/:roleId/permissions` (MIS-only, see
 * `AccessControlRouter.ts`) - matches the mockup shown and approved before implementation.
 */
export function RolesPermissionsTab() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [draftCodes, setDraftCodes] = React.useState<Set<string> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['roles-permissions'],
    queryFn: () => apiClient.get<ListRolesAndPermissionsResponse>('/roles-permissions'),
  });

  const roles = query.data?.roles ?? [];
  const permissions = query.data?.permissions ?? [];
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];

  React.useEffect(() => {
    if (!selectedRoleId && roles.length > 0) setSelectedRoleId(roles[0]!.id);
  }, [roles, selectedRoleId]);

  // Reset the draft whenever the selected role changes (or its server data refreshes after a save).
  const activeCodes = draftCodes ?? new Set(selectedRole?.permissionCodes ?? []);
  const isDirty =
    draftCodes !== null &&
    selectedRole !== undefined &&
    (draftCodes.size !== selectedRole.permissionCodes.length || selectedRole.permissionCodes.some((c) => !draftCodes.has(c)));

  const selectRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    setDraftCodes(null);
    setError(null);
  };

  const toggle = (code: string, checked: boolean) => {
    const next = new Set(activeCodes);
    if (checked) next.add(code);
    else next.delete(code);
    setDraftCodes(next);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedRole) return Promise.reject(new Error('No role selected'));
      return apiClient.patch(`/roles/${selectedRole.id}/permissions`, { permissionCodes: [...activeCodes] });
    },
    onSuccess: () => {
      setDraftCodes(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['roles-permissions'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save permission changes.'),
  });

  const groups = groupPermissions(permissions, search);

  if (query.isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (query.isError) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" /> Could not load roles and permissions.
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
        <div className="border-b py-3 sm:border-b-0 sm:border-r">
          <p className="px-4 pb-2 text-xs font-medium text-muted-foreground">Roles</p>
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => selectRole(role.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors',
                role.id === selectedRole?.id
                  ? 'border-l-2 border-l-primary bg-primary/5 font-medium text-primary'
                  : 'border-l-2 border-l-transparent text-muted-foreground hover:bg-muted/50',
              )}
            >
              <span>{roleFullLabel(role.name)}</span>
              <span className="text-xs">{role.userCount}</span>
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {selectedRole && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-medium">{roleFullLabel(selectedRole.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedRole.userCount} staff assigned - changes apply to all of them
                  </p>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search permissions"
                  className="pl-9"
                />
              </div>

              <div className="space-y-3">
                {groups.map((group) => {
                  const grantedCount = group.permissions.filter((p) => activeCodes.has(p.code)).length;
                  return (
                    <div key={group.label} className="overflow-hidden rounded-md border">
                      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                        <group.icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{group.label}</span>
                        <span
                          className={cn(
                            'ml-auto text-xs',
                            grantedCount === 0 ? 'text-muted-foreground' : 'text-success',
                          )}
                        >
                          {grantedCount} of {group.permissions.length} granted
                        </span>
                      </div>
                      {group.permissions.map((p, i) => (
                        <div
                          key={p.id}
                          className={cn('flex items-center justify-between gap-3 px-3 py-2.5', i > 0 && 'border-t')}
                        >
                          <span className={cn('text-sm', !activeCodes.has(p.code) && 'text-muted-foreground')}>
                            {p.description ?? p.code}
                          </span>
                          <Switch
                            checked={activeCodes.has(p.code)}
                            onCheckedChange={(checked) => toggle(p.code, checked)}
                            aria-label={p.description ?? p.code}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
                {groups.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No permissions match "{search}".</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Restricted-access placeholder, matching every other MIS-only card's shape in this app
 * (`ReminderSettingsCard`'s own doc comment). */
export function RolesPermissionsRestricted({ currentAccountName, currentAccountRole }: { currentAccountName: string; currentAccountRole: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
        <CardDescription>Configure which actions each role can perform.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Restricted to MIS accounts</p>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{currentAccountName}</span> ({currentAccountRole}).
        </p>
      </CardContent>
    </Card>
  );
}
