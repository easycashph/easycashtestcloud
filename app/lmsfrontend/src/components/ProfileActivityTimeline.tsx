/**
 * Profile Activity Timeline Component
 *
 * Displays a chronological timeline of all actions taken on a profile
 * (Loan Application, Client, or Loan Account) by loan officers.
 *
 * Shows: who, what action, when, and detailed information about the change.
 * Supports cursor pagination for large histories.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
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

  return (
    <div className="space-y-0 divide-y">
      {accumulated.map((activity, index) => {
        const isExpanded = expandedIds.has(activity.id);
        const hasDetails = Object.keys(activity.details).length > 0;

        return (
          <div key={activity.id} className={index === 0 ? 'py-4' : 'pt-6 pb-4'}>
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-primary ring-2 ring-primary/20" />
                {index < accumulated.length - 1 && <div className="mt-2 h-12 w-0.5 bg-border" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{activity.formattedAction}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activity.user.firstName} {activity.user.lastName}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                    {formatRelativeOrAbsolute(activity.createdAt)}
                  </span>
                </div>

                {showDetailsToggle && hasDetails && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(activity.id)}
                    className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" /> Hide details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" /> Show details
                      </>
                    )}
                  </button>
                )}

                {showDetailsToggle && isExpanded && (
                  <div className="mt-3 rounded-md border bg-secondary/30 p-3">
                    <pre className="max-h-64 overflow-auto font-mono text-xs text-muted-foreground">
                      {JSON.stringify(activity.details, null, 2)}
                    </pre>
                  </div>
                )}

                {activity.deletedByMisAt && (
                  <p className="mt-2 text-xs text-destructive">Deleted by MIS at {formatDateTime(activity.deletedByMisAt)}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {data?.cursor && (
        <div className="mt-6 border-t pt-4">
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
