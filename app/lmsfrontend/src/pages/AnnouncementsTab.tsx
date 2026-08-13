import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, ApiError } from '@/lib/apiClient';
import {
  ANNOUNCEMENT_TEMPLATES,
  type CreateSystemAnnouncementInput,
  type SystemAnnouncement,
  type SystemAnnouncementType,
  type UpdateSystemAnnouncementInput,
} from '@/lib/systemAnnouncementApiTypes';

const TYPE_LABELS: Record<SystemAnnouncementType, string> = {
  MAINTENANCE: 'Maintenance',
  NEWS: 'News',
  GENERAL: 'General',
};

const TYPE_BADGE_VARIANT: Record<SystemAnnouncementType, 'warning' | 'default' | 'secondary'> = {
  MAINTENANCE: 'warning',
  NEWS: 'default',
  GENERAL: 'secondary',
};

function isExpired(announcement: SystemAnnouncement): boolean {
  return announcement.expiresAt !== null && new Date(announcement.expiresAt).getTime() <= Date.now();
}

/** `datetime-local` inputs work in the browser's local time and have no seconds/timezone suffix -
 * this round-trips that string to/from a real ISO instant without silently shifting the hour. */
function localDateTimeToIso(value: string): string {
  return new Date(value).toISOString();
}

const EMPTY_FORM = { templateLabel: 'Custom', title: '', body: '', type: 'GENERAL' as SystemAnnouncementType, showOnLms: true, showOnPortal: true, expiresAtLocal: '' };

/**
 * Settings > System > Announcements (2026-08-14 user request) - MIS posts a maintenance/news
 * announcement that shows as an attention popup to LMS staff and/or Portal clients, so they aren't
 * caught off guard by scheduled/emergency downtime. Template picker prefills the form with common
 * starter content; every field stays editable before posting, and "Custom" leaves it blank.
 */
export function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);

  const announcementsQuery = useQuery({
    queryKey: ['system-announcements'],
    queryFn: () => apiClient.get<SystemAnnouncement[]>('/system-announcements'),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateSystemAnnouncementInput) => apiClient.post<SystemAnnouncement>('/system-announcements', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-announcements'] });
      setForm(EMPTY_FORM);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not post the announcement.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateSystemAnnouncementInput }) =>
      apiClient.patch<SystemAnnouncement>(`/system-announcements/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-announcements'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/system-announcements/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-announcements'] }),
  });

  const applyTemplate = (label: string) => {
    const template = ANNOUNCEMENT_TEMPLATES.find((t) => t.label === label);
    if (!template) return;
    setForm((f) => ({ ...f, templateLabel: label, title: template.title, body: template.body, type: template.type }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.showOnLms && !form.showOnPortal) {
      setError('Select at least one audience (LMS or Portal).');
      return;
    }
    createMutation.mutate({
      title: form.title,
      body: form.body,
      type: form.type,
      showOnLms: form.showOnLms,
      showOnPortal: form.showOnPortal,
      expiresAt: form.expiresAtLocal ? localDateTimeToIso(form.expiresAtLocal) : null,
    });
  };

  const announcements = announcementsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Post an Announcement
          </CardTitle>
          <CardDescription>
            Give LMS staff and/or Portal clients a heads-up before maintenance or downtime, so they aren't caught off guard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Start from a template</Label>
              <Select value={form.templateLabel} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_TEMPLATES.map((t) => (
                    <SelectItem key={t.label} value={t.label}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Prefills the fields below - everything stays editable, or pick "Custom" to write your own.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="announcement-title">Title *</Label>
                <Input id="announcement-title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as SystemAnnouncementType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as SystemAnnouncementType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="announcement-body">Message *</Label>
              <Textarea
                id="announcement-body"
                required
                rows={4}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="What do users need to know?"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-md border p-3">
                <Label>Audience</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Show on LMS</span>
                  <Switch checked={form.showOnLms} onCheckedChange={(checked) => setForm((f) => ({ ...f, showOnLms: checked }))} aria-label="Show on LMS" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Show on Portal</span>
                  <Switch checked={form.showOnPortal} onCheckedChange={(checked) => setForm((f) => ({ ...f, showOnPortal: checked }))} aria-label="Show on Portal" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="announcement-expiry">Auto-expire at (optional)</Label>
                <Input
                  id="announcement-expiry"
                  type="datetime-local"
                  value={form.expiresAtLocal}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAtLocal: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Leave blank to keep showing until you deactivate it yourself.</p>
              </div>
            </div>

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Posting…' : 'Post Announcement'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Every announcement ever posted - active, deactivated, or expired.</CardDescription>
        </CardHeader>
        <CardContent>
          {announcementsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : announcements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No announcements posted yet.</p>
          ) : (
            <ul className="divide-y">
              {announcements.map((a) => {
                const expired = isExpired(a);
                const statusLabel = !a.active ? 'Deactivated' : expired ? 'Expired' : 'Active';
                const statusVariant = !a.active ? 'secondary' : expired ? 'secondary' : 'success';
                return (
                  <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{a.title}</p>
                        <Badge variant={TYPE_BADGE_VARIANT[a.type]} className="text-[10px]">
                          {TYPE_LABELS[a.type]}
                        </Badge>
                        <Badge variant={statusVariant} className="text-[10px]">
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{a.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[a.showOnLms && 'LMS', a.showOnPortal && 'Portal'].filter(Boolean).join(' + ')}
                        {' · '}Posted {new Date(a.createdAt).toLocaleString()}
                        {a.expiresAt ? ` · Expires ${new Date(a.expiresAt).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: a.id, patch: { active: !a.active } })}
                      >
                        {a.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Delete this announcement permanently? This cannot be undone.')) {
                            deleteMutation.mutate(a.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
