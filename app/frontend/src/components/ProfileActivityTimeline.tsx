/**
 * Profile Activity Timeline Component
 *
 * Displays a chronological timeline of all actions taken on a profile
 * (Loan Application, Client, or Loan Account) by loan officers.
 *
 * Shows: who, what action, when, and detailed information about the change.
 * Supports cursor pagination for large histories.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProfileType, ProfileActivityLogRecord } from '@/lib/profileActivityApiTypes';
import type { GetProfileActivityResponse } from '@/lib/profileActivityApiTypes';
import { apiClient } from '@/lib/apiClient';

interface ProfileActivityTimelineProps {
  profileType: ProfileType;
  profileId: string;
  limit?: number;
  onError?: (error: Error) => void;
}

export function ProfileActivityTimeline({
  profileType,
  profileId,
  limit = 50,
  onError,
}: ProfileActivityTimelineProps) {
  const [cursor, setCursor] = useState<string | undefined>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ['profile-activity', profileType, profileId, cursor],
    queryFn: async () => {
      const basePath =
        profileType === 'BORROWER'
          ? 'borrowers'
          : profileType === 'LOAN_APPLICATION'
            ? 'loan-applications'
            : 'loan-accounts';

      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (cursor) params.set('cursor', cursor);

      const path = `/${basePath}/${profileId}/activity?${params.toString()}`;
      const response = await apiClient.get<GetProfileActivityResponse>(path);
      return response;
    },
  });

  if (error && onError) {
    onError(error instanceof Error ? error : new Error('Failed to load activity'));
  }

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading activity...</span>
      </div>
    );
  }

  const activities = data?.activities || [];

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 divide-y divide-gray-200">
      {activities.map((activity: ProfileActivityLogRecord, index: number) => {
        const isExpanded = expandedIds.has(activity.id);
        const isFirst = index === 0;

        return (
          <div
            key={activity.id}
            className={`py-4 ${!isFirst && 'pt-6'}`}
          >
            {/* Timeline point and connector */}
            <div className="flex gap-4">
              {/* Timeline marker */}
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                {index < activities.length - 1 && (
                  <div className="h-12 w-0.5 bg-gray-200 mt-2" />
                )}
              </div>

              {/* Activity content */}
              <div className="flex-1 min-w-0">
                {/* Header: Action and timestamp */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {activity.formattedAction}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {activity.user.firstName} {activity.user.lastName}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>

                {/* Expandable details */}
                {Object.keys(activity.details).length > 0 && (
                  <button
                    onClick={() => toggleExpanded(activity.id)}
                    className="mt-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Hide details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show details
                      </>
                    )}
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                    <pre className="text-xs text-gray-700 overflow-auto max-h-64 font-mono">
                      {JSON.stringify(activity.details, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Soft-deleted indicator */}
                {activity.deletedByMisAt && (
                  <p className="mt-2 text-xs text-red-600">
                    Deleted by MIS at {new Date(activity.deletedByMisAt).toLocaleString('en-PH')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Pagination controls */}
      {data?.cursor && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setCursor(data.cursor)}
            className="w-full px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            Load more activity
          </button>
        </div>
      )}
    </div>
  );
}
