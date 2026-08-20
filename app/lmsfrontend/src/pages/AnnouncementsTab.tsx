import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ImagePlus, Megaphone, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, API_BASE_URL, ApiError, uploadFile } from '@/lib/apiClient';
import {
  ANNOUNCEMENT_TEMPLATES,
  type CreateSystemAnnouncementInput,
  type SystemAnnouncement,
  type SystemAnnouncementType,
  type UpdateSystemAnnouncementInput,
} from '@/lib/systemAnnouncementApiTypes';
import {
  DEFAULT_MANUAL_POST_DURATION_MINUTES,
  MANUAL_POST_DURATION_PRESETS,
  type MisPost,
} from '@/lib/misPostApiTypes';

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

      <PortalPostsSection />
    </div>
  );
}

const EMPTY_POST_FORM = { caption: '', durationMinutes: DEFAULT_MANUAL_POST_DURATION_MINUTES };

/**
 * Portal Posts (2026-08-20 user request) - "gagawa ng custom post ang MIS, na ipopost nya... sa
 * tabi ng automatic post ng system". Two independent things live here: the read-only status of the
 * system's daily auto-rotating post (borrowers see this on the Portal without any MIS action), and
 * the manual-post composer - a Facebook-style image + caption post with a duration (default preset
 * 30 minutes, per the user's explicit request) after which it disappears on its own.
 */
function PortalPostsSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState(EMPTY_POST_FORM);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const postsQuery = useQuery({
    queryKey: ['mis-posts'],
    queryFn: () => apiClient.get<MisPost[]>('/mis-posts'),
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => uploadFile<MisPost>('/mis-posts/manual', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-posts'] });
      setForm(EMPTY_POST_FORM);
      setImageFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not post.'),
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/mis-posts/manual/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mis-posts'] }),
  });

  const handleFileChange = (file: File | null) => {
    setImageFile(file);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!imageFile) {
      setError('An image is required.');
      return;
    }
    if (!form.caption.trim()) {
      setError('Caption is required.');
      return;
    }
    const formData = new FormData();
    formData.set('image', imageFile);
    formData.set('caption', form.caption);
    formData.set('durationMinutes', String(form.durationMinutes));
    createMutation.mutate(formData);
  };

  const posts = postsQuery.data ?? [];
  const pool = posts.filter((p) => p.type === 'AUTO_ROTATION').sort((a, b) => (a.poolOrder ?? 0) - (b.poolOrder ?? 0));
  const livePost = pool.find((p) => p.isCurrentlyLive) ?? null;
  const manualPosts = posts.filter((p) => p.type === 'MANUAL');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4" /> Portal Posts
        </CardTitle>
        <CardDescription>
          Facebook-style posts shown to borrowers on the Portal homepage and News & Announcements page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RotateCw className="h-3.5 w-3.5 text-muted-foreground" /> Today's automatic post
          </div>
          {postsQuery.isLoading ? (
            <p className="mt-1 text-xs text-muted-foreground">Loading…</p>
          ) : livePost ? (
            <div className="mt-2 flex items-center gap-3">
              <img src={`${API_BASE_URL}${livePost.imageUrl}`} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
              <p className="line-clamp-2 text-xs text-muted-foreground">{livePost.caption}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No rotation pool item is live yet - it lights up automatically once seeded.
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Rotates automatically every 24 hours through a {pool.length}-item pool - no action needed from MIS.
          </p>
        </div>

        <form className="space-y-4 border-t pt-4" onSubmit={handleSubmit}>
          <p className="text-sm font-medium">Post a custom announcement (e.g. typhoon, office closure)</p>
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="mis-post-image">Image *</Label>
            <input
              ref={fileInputRef}
              id="mis-post-image"
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            {imagePreviewUrl && <img src={imagePreviewUrl} alt="Preview" className="mt-2 h-28 w-28 rounded object-cover" />}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mis-post-caption">Caption *</Label>
            <Textarea
              id="mis-post-caption"
              required
              rows={3}
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              placeholder="What should borrowers know?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>How long should it show?</Label>
            <Select
              value={String(form.durationMinutes)}
              onValueChange={(v) => setForm((f) => ({ ...f, durationMinutes: Number(v) }))}
            >
              <SelectTrigger className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_POST_DURATION_PRESETS.map((preset) => (
                  <SelectItem key={preset.minutes} value={String(preset.minutes)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Defaults to 30 minutes; disappears from the Portal automatically once it expires.</p>
          </div>

          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Posting…' : 'Post to Portal'}
          </Button>
        </form>

        <div className="border-t pt-4">
          <p className="text-sm font-medium">Custom post history</p>
          {manualPosts.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No custom posts yet.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {manualPosts.map((p) => {
                const expired = p.expiresAt !== null && new Date(p.expiresAt).getTime() <= Date.now();
                const live = !p.withdrawn && !expired;
                return (
                  <li key={p.id} className="flex items-start gap-3 py-3">
                    <img src={`${API_BASE_URL}${p.imageUrl}`} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={live ? 'success' : 'secondary'} className="text-[10px]">
                          {p.withdrawn ? 'Withdrawn' : expired ? 'Expired' : 'Live'}
                        </Badge>
                        <p className="text-[11px] text-muted-foreground">
                          Posted {p.publishedAt ? new Date(p.publishedAt).toLocaleString() : '—'}
                          {p.expiresAt ? ` · Expires ${new Date(p.expiresAt).toLocaleString()}` : ''}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.caption}</p>
                    </div>
                    {live && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={withdrawMutation.isPending}
                        onClick={() => withdrawMutation.mutate(p.id)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
