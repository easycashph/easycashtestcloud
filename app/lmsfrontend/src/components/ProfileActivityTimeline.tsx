/**
 * Profile Activity Timeline Component
 *
 * Displays a chronological timeline of all actions taken on a profile
 * (Loan Application, Client, or Loan Account) by loan officers.
 *
 * Shows: who, what action, when, and detailed information about the change.
 * Supports cursor pagination for large histories.
 *
 * 2026-09-09 (user request, "gawing high-end, advance sophisticated na design ... hindi malaki
 * tignan"): redesigned from a tall dot-and-connecting-line timeline (2 lines + generous padding
 * per entry) to compact single-line rows with a small colored icon per action type, grouped under
 * date headers (Today/Yesterday/older) - same information, far less vertical space per entry.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Circle, Eye, FilePlus, Loader2, Pencil, RotateCcw, Save, Trash2, X } from 'lucide-react';
import type { GetProfileActivityResponse, ProfileActivityLogRecord, ProfileType } from '@/lib/profileActivityApiTypes';
import { apiClient } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/utils';

interface ProfileActivityTimelineProps {
  profileType: ProfileType;
  profileId: string;
  limit?: number;
  onError?: (error: Error) => void;
  showDetailsToggle?: boolean;
}

function activityBasePath(profileType: ProfileType): string {
  if (profileType === 'BORROWER') return 'borrowers';
  if (profileType === 'LOAN_APPLICATION') return 'loan-applications';
  return 'loan-accounts';
}

/** Relative time for anything in the last week, absolute date/time beyond that - same convention as `formatDateTime` elsewhere, just with a "just now"/"Xm ago" short form for recent activity. */
function formatRelativeOrAbsolute(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateTime(dateString);
}

/** "Today" / "Yesterday" / an absolute date - used as the group header above a run of same-day
 * entries. Calendar-day comparison (local time), not a 24h rolling window. */
function dateGroupLabel(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

type IconSpec = { Icon: React.ComponentType<{ className?: string }>; className: string };

/** Small colored icon per action, so the compact single-line row still reads at a glance without
 * needing to read the text. Loan application decision transitions (approve/decline/revert/tag/
 * undo) all share the generic `decision_updated` action code server-side - `details.toStatus` (set
 * by ProfileActivityLogService.actions.decisionUpdated) disambiguates those; everything else falls
 * back to keyword-matching the snake_case `action` code, with a neutral dot as the final fallback. */
function iconForActivity(activity: ProfileActivityLogRecord): IconSpec {
  if (activity.action === 'decision_updated') {
    const toStatus = typeof activity.details.toStatus === 'string' ? activity.details.toStatus : '';
    if (toStatus === 'APPROVED' || toStatus === 'ACTIVE') return { Icon: Check, className: 'bg-success/15 text-success' };
    if (toStatus === 'DECLINED') return { Icon: X, className: 'bg-destructive/15 text-destructive' };
    if (toStatus === 'PRE_APPROVAL') return { Icon: Check, className: 'bg-success/15 text-success' };
    if (toStatus === 'UNDER_REVIEW') return { Icon: Eye, className: 'bg-primary/15 text-primary' };
    return { Icon: RotateCcw, className: 'bg-warning/15 text-warning' };
  }
  const action = activity.action.toLowerCase();
  if (action.includes('delete')) return { Icon: Trash2, className: 'bg-destructive/15 text-destructive' };
  if (action.includes('revert') || action.includes('undo')) return { Icon: RotateCcw, className: 'bg-warning/15 text-warning' };
  if (action.includes('created') || action.includes('upload') || action.includes('recorded') || action.includes('generated')) {
    return { Icon: FilePlus, className: 'bg-primary/15 text-primary' };
  }
  if (action.includes('updated') || action.includes('saved') || action.includes('edited')) {
    return { Icon: Save, className: 'bg-muted text-muted-foreground' };
  }
  if (action.includes('review')) return { Icon: Eye, className: 'bg-primary/15 text-primary' };
  if (action.includes('note')) return { Icon: Pencil, className: 'bg-muted text-muted-foreground' };
  return { Icon: Circle, className: 'bg-muted text-muted-foreground' };
}

export function ProfileActivityTimeline({
  profileType,
  profileId,
  limit = 50,
  onError,
  showDetailsToggle = true,
}: ProfileActivityTimelineProps) {
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  // Cursor pagination fetches one page per queryKey - accumulated here across "Load more" clicks
  // so the list grows instead of being replaced by just the newest page. Reset whenever the
  // profile itself changes, not on every cursor change.
  const [accumulated, setAccumulated] = React.useState<ProfileActivityLogRecord[]>([]);

  React.useEffect(() => {
    setCursor(undefined);
    setAccumulated([]);
  }, [profileType, profileId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['profile-activity', profileType, profileId, cursor],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (cursor) params.set('cursor', cursor);
      return apiClient.get<GetProfileActivityResponse>(`/${activityBasePath(profileType)}/${profileId}/activity?${params.toString()}`);
    },
  });

  React.useEffect(() => {
    if (!data) return;
    setAccumulated((prev) => (cursor ? [...prev, ...data.activities] : data.activities));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  React.useEffect(() => {
    if (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to load activity'));
    }
  }, [error, onError]);

  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (isLoading && accumulated.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading activity…</span>
      </div>
    );
  }

  if (error && accumulated.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" /> Could not load activity. Please try again.
      </div>
    );
  }

  if (accumulated.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  // 2026-09-09: capped height + internal scroll instead of letting the card grow without bound -
  // "Load more" (cursor pagination) stays reachable by scrolling to the bottom of this box.
  return (
    <div className="max-h-[420px] overflow-y-auto pr-1">
      {accumulated.map((activity, index) => {
        const isExpanded = expandedIds.has(activity.id);
        const hasDetails = Object.keys(activity.details).length > 0;
        const { Icon, className: iconClassName } = iconForActivity(activity);
        const group = dateGroupLabel(activity.createdAt);
        const showGroupHeader = index === 0 || dateGroupLabel(accumulated[index - 1].createdAt) !== group;

        return (
          <React.Fragment key={activity.id}>
            {showGroupHeader && (
              <p className={`mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${index === 0 ? '' : 'mt-3'}`}>
                {group}
              </p>
            )}
            <div className="flex items-center gap-2.5 border-b py-1.5 last:border-0">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
                <Icon className="h-3 w-3" />
              </div>
              <p className="min-w-0 flex-1 truncate text-sm">
                {activity.formattedAction}
                <span className="text-muted-foreground"> · {activity.user.firstName} {activity.user.lastName}</span>
              </p>
              {showDetailsToggle && hasDetails && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(activity.id)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  {isExpanded ? 'Hide' : 'Details'}
                </button>
              )}
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatRelativeOrAbsolute(activity.createdAt)}</span>
            </div>

            {showDetailsToggle && isExpanded && (
              <div className="mb-1.5 rounded-md border bg-secondary/30 p-3">
                <pre className="max-h-64 overflow-auto font-mono text-xs text-muted-foreground">
                  {JSON.stringify(activity.details, null, 2)}
                </pre>
              </div>
            )}

            {activity.deletedByMisAt && (
              <p className="mb-1.5 text-xs text-destructive">Deleted by MIS at {formatDateTime(activity.deletedByMisAt)}</p>
            )}
          </React.Fragment>
        );
      })}

      {data?.cursor && (
        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            onClick={() => setCursor(data.cursor)}
            disabled={isLoading}
            className="w-full rounded px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : 'Load more activity'}
          </button>
        </div>
      )}
    </div>
  );
}
